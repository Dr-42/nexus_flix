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

#[derive(Deserialize)]
pub struct VideoRequest {
    pub path: String,
    pub timestamp: Option<f64>,
}

#[derive(Deserialize)]
pub struct VideoDurationRequest {
    pub path: String,
}

pub async fn serve_video_duration(Query(params): Query<VideoDurationRequest>) -> impl IntoResponse {
    let input_path = params.path;
    let video_duration = get_video_metadata(&input_path).await;

    println!("Video duration: {:?}", video_duration);

    if video_duration.is_err() {
        return Response::builder()
            .status(404)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::new("Video not found".to_string()))
            .unwrap();
    }
    let video_duration = video_duration.unwrap();

    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::new(video_duration.to_string()))
        .unwrap()
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
        let mut ffmpeg = Command::new("ffmpeg")
            .args(["-v", "quiet"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &input_path])
            .args(["-t", &chunk_duration.to_string()])
            .args(["-c:v", "h264_nvenc"])
            .args(["-preset", "fast"])
            .args(["-b:v", "2M"])
            .args(["-force_key_frames", "expr:gte(t,n_forced*2)"])
            .args(["-c:a", "libopus"])
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

async fn get_video_metadata(input_path: &str) -> Result<f64, String> {
    println!("Input path: {}", input_path);
    let output = Command::new("ffprobe")
        .args([
            "-select_streams",
            "v:0",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            input_path,
        ])
        .output()
        .await
        .map_err(|_| "Failed to execute ffprobe")
        .unwrap();

    let output_str = String::from_utf8_lossy(&output.stdout);
    println!("Output: {}", output_str);
    let mut lines = output_str.lines();
    let duration = lines.next().and_then(|s| s.trim().parse::<f64>().ok());

    println!("Duration: {:?}", duration);

    // Flush the remaining lines
    while lines.next().is_some() {}

    Ok(duration.unwrap())
}
