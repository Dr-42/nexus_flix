use axum::{
    body::Body,
    extract::Query,
    response::{IntoResponse, Response},
};
use hyper::header::{self};
use serde::Deserialize;
use std::{
    process::Stdio,
    sync::{Arc, Mutex},
};
use tokio::{
    io::AsyncReadExt,
    process::Command,
    sync::watch::{self, Receiver, Sender},
};

mod video_helpers;

#[derive(Deserialize)]
pub struct VideoRequest {
    pub path: String,
    pub timestamp: Option<f64>,
}

#[derive(Deserialize)]
pub struct VideoMetadataRequest {
    pub path: String,
}

pub async fn serve_video_metadata(Query(params): Query<VideoMetadataRequest>) -> impl IntoResponse {
    let input_path = params.path;
    let video_metadata = video_helpers::get_video_metadata(&input_path).await;
    match video_metadata {
        Err(e) => Response::builder()
            .status(404)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::new(format!("Video metadata error: {}", e)))
            .unwrap(),
        Ok(data) => Response::builder()
            .status(200)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::new(serde_json::to_string(&data).unwrap()))
            .unwrap(),
    }
}

// Serve video with timestamp-based range support
pub async fn serve_video_with_timestamp(Query(params): Query<VideoRequest>) -> impl IntoResponse {
    let input_path = params.path;

    println!("Input path: {}", input_path);

    // Get timestamp from the query parameters or default to 0
    let start_timestamp = params.timestamp.unwrap_or(0.0);

    println!("Start timestamp: {}", start_timestamp);

    // Create buffer for transcoded data
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();

    println!("Start timestamp: {}s", start_timestamp);

    let chunk_duration = 10.0;

    // Spawn FFmpeg transcoding process
    let (tx, _rx): (Sender<()>, Receiver<()>) = watch::channel(());
    let handle = tokio::spawn(async move {
        let mut ffmpeg = Command::new("ffmpeg-next")
            //.args(["-v", "quiet"])
            .args(["-v", "error"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &input_path])
            .args(["-t", &chunk_duration.to_string()])
            .args(["-c:v", "h264_nvenc"])
            .args(["-vf", "scale_cuda=1080:720:format=yuv420p"])
            .args(["-preset", "p5"])
            .args(["-b:v", "2M"])
            .args(["-force_key_frames", "expr:gte(t,n_forced*2)"])
            .args(["-c:a", "libfdk_aac"])
            .args(["-b:a", "128k"])
            .args([
                "-movflags",
                "frag_keyframe+empty_moov+faststart+default_base_moof",
            ])
            .args(["-f", "mp4"])
            .args(["pipe:1"])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = vec![0; 1024 * 1024 * 12];
            let mut total_bytes = 0;
            loop {
                match stdout.read(&mut read_buf).await {
                    Ok(0) => {
                        println!("Bytes read: {}", total_bytes);
                        break;
                    }
                    Ok(bytes_read) => {
                        let mut buffer_writer = buffer_clone.lock().unwrap();
                        buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                        total_bytes += bytes_read;
                    }
                    Err(e) => {
                        eprintln!("Failed to read FFmpeg stdout: {}", e);
                    }
                }
            }
        }

        tx.send(()).unwrap();
    });
    println!("Transcoding started");

    handle.await.unwrap();

    println!("Transcoding finished");
    // Stream buffered content to the client
    let buffer_reader = buffer.lock().unwrap();
    let transcoded_size = buffer_reader.len();
    println!("Transcoded size: {}", transcoded_size);
    let body = Body::from(buffer_reader.clone()); // Clone to allow simultaneous use

    let mut res = Response::builder().status(206).body(body).unwrap();

    let response_headers = res.headers_mut();
    response_headers.insert(header::CONTENT_TYPE, "video/mp4".parse().unwrap());
    response_headers.insert(
        header::CONTENT_LENGTH,
        transcoded_size.to_string().parse().unwrap(),
    );

    res
}
