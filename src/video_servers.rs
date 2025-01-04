use axum::{
    body::Body,
    extract::Query,
    response::{IntoResponse, Response},
};
use hyper::header::{self};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

#[derive(Serialize, Debug)]
pub enum Tracktype {
    Audio,
    Video,
    Subtitle,
}

#[derive(Serialize, Debug)]
pub struct Track {
    pub id: String,
    pub kind: Tracktype,
    pub label: String,
    pub codec: String,
    pub color_format: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct VideoMetadata {
    pub duration: f64,
    pub tracks: Vec<Track>,
}

pub async fn serve_video_data(Query(params): Query<VideoDurationRequest>) -> impl IntoResponse {
    let input_path = params.path;
    let video_metadata = get_video_metadata(&input_path).await;

    println!("Video duration: {:#?}", video_metadata);

    if video_metadata.is_err() {
        return Response::builder()
            .status(404)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::new("Video not found".to_string()))
            .unwrap();
    }
    let video_metadata = video_metadata.unwrap();
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::new(serde_json::to_string(&video_metadata).unwrap()))
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
        let mut ffmpeg = Command::new("ffmpeg-next")
            //.args(["-v", "quiet"])
            .args(["-v", "error"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &input_path])
            .args(["-t", &chunk_duration.to_string()])
            .args(["-c:v", "h264_nvenc"])
            .args(["-vf", "scale_cuda=format=yuv420p"])
            .args(["-preset", "p5"])
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

async fn get_video_metadata(input_path: &str) -> Result<VideoMetadata, String> {
    println!("Input path: {}", input_path);
    let output = Command::new("ffprobe")
        .args(["-v", "quiet"])
        .args(["-print_format", "json"])
        .args(["-show_streams"])
        .args([input_path])
        .output()
        .await
        .map_err(|_| "Failed to execute ffprobe")
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    //println!("Stdout: {}", stdout);
    let metadata: Value = serde_json::from_str(&stdout).unwrap();
    let mut tracks: Vec<Track> = Vec::new();

    let metadata = metadata["streams"].as_array().unwrap();

    for stream in metadata {
        if let Some(track_type) = stream.get("codec_type") {
            let track_type = match track_type.as_str().unwrap() {
                "audio" => Tracktype::Audio,
                "video" => Tracktype::Video,
                "subtitle" => Tracktype::Subtitle,
                _ => continue,
            };
            let track_id = stream["index"].as_u64().unwrap();
            let tags = stream["tags"].as_object();
            let label = if let Some(tags) = tags {
                if let Some(label) = tags.get("language") {
                    label.as_str().unwrap().to_string()
                } else if let Some(label) = tags.get("title") {
                    label.as_str().unwrap().to_string()
                } else {
                    format!("Track {}", track_id)
                }
            } else {
                format!("Track {}", track_id)
            };
            let color_format = stream
                .get("pix_fmt")
                .map(|color_format| color_format.as_str().unwrap().to_string());
            let codec = stream["codec_name"].as_str().unwrap();
            let track = Track {
                id: track_id.to_string(),
                kind: track_type,
                label,
                codec: codec.to_string(),
                color_format,
            };
            tracks.push(track);
        }
    }
    let output = Command::new("ffprobe")
        .args(["-select_streams", "v:0"])
        .args(["-show_entries", "format=duration"])
        .args(["-of", "default=noprint_wrappers=1:nokey=1"])
        .args([input_path])
        .output()
        .await
        .map_err(|_| "Failed to execute ffprobe")
        .unwrap();

    let output_str = String::from_utf8_lossy(&output.stdout);
    println!("Output: {}", output_str);
    let mut lines = output_str.lines();
    let duration = lines
        .next()
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap();

    let metadata = VideoMetadata { tracks, duration };
    Ok(metadata)
}
