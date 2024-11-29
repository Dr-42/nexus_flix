use axum::{
    body::Body,
    extract::{Path, Query},
    http::HeaderMap,
    response::{IntoResponse, Response},
    routing::get,
    Router,
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

async fn serve_index() -> impl IntoResponse {
    let index_text = include_str!("../index.html");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/html")
        .body(Body::new(index_text.to_string()))
        .unwrap()
}

async fn get_video_metadata(input_path: &str) -> Result<f64, String> {
    println!("Input path: {}", input_path);
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
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

#[derive(Deserialize)]
struct VideoRequest {
    timestamp: Option<f64>,
}

async fn serve_video_duration(Path(filename): Path<String>) -> impl IntoResponse {
    let input_path = format!("./videos/{}", filename);
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
async fn serve_video_with_timestamp(
    Path(filename): Path<String>,
    Query(params): Query<VideoRequest>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let input_path = format!("./videos/{}", filename);

    let video_bitrate = 2000000.0;
    let audio_bitrate = 128000.0;

    // Get timestamp from the query parameters or default to 0
    let start_timestamp = params.timestamp.unwrap_or(0.0);

    // Create buffer for transcoded data
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();

    println!("Start timestamp: {}s", start_timestamp);

    let video_duration = get_video_metadata(&input_path).await.unwrap();
    let estimated_size = (video_bitrate + audio_bitrate) * video_duration / 8.0;

    // Spawn FFmpeg transcoding process
    let (tx, _rx): (Sender<()>, Receiver<()>) = watch::channel(());
    let handle = tokio::spawn(async move {
        let mut ffmpeg = Command::new("ffmpeg")
            .args([
                "-v",
                "quiet",
                "-hwaccel",
                "cuda",
                "-hwaccel_output_format",
                "cuda",
                "-ss",
                &start_timestamp.to_string(),
                "-i",
                &input_path,
                "-t",
                "120.0",
                "-c:v",
                "h264_nvenc",
                "-preset",
                "fast",
                "-b:v",
                "2M",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "frag_keyframe+empty_moov",
                "-f",
                "mp4",
                "pipe:1",
            ])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = Vec::new();
            // if let Ok(bytes_read) = stdout.read_exact(&mut read_buf).await {
            //     let mut buffer_writer = buffer_clone.lock().unwrap();
            //     buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
            // } else {
            //     eprintln!("Failed to read FFmpeg stdout");
            // }
            match stdout.read(&mut read_buf).await {
                Ok(bytes_read) => {
                    let mut buffer_writer = buffer_clone.lock().unwrap();
                    buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                    println!("Read {} bytes", bytes_read);
                    println!("Buffer: {:?}", read_buf);
                }
                Err(e) => {
                    eprintln!("Failed to read FFmpeg stdout: {}", e);
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

    Response::builder()
        .status(206)
        .header(header::CONTENT_TYPE, "video/mp4")
        .header(header::ACCEPT_RANGES, "bytes")
        .header(
            header::CONTENT_RANGE,
            format!("bytes 0-{}/{}", transcoded_size, estimated_size),
        )
        .header(header::CONTENT_LENGTH, transcoded_size.to_string())
        .body(body)
        .unwrap()
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(serve_index))
        .route("/video/:filename", get(serve_video_with_timestamp))
        .route("/video-duration/:filename", get(serve_video_duration));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
