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
            // "-v",
            // "error",
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
    //Ok(11000.0)
}

#[derive(Deserialize)]
struct VideoRequest {
    timestamp: Option<f64>,
}

async fn serve_video_duration(Path(filename): Path<String>) -> impl IntoResponse {
    let input_path = format!("./videos/{}", filename);
    let input_path = "./videos/sample.mp4";
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

fn parse_content_range(content_range: &str) -> Option<u64> {
    if let Some(stripped) = content_range.strip_prefix("bytes-") {
        stripped.split('-').next().and_then(|s| s.parse().ok())
    } else {
        None
    }
}

// Serve video with timestamp-based range support
async fn serve_video_with_timestamp(
    Path(filename): Path<String>,
    Query(params): Query<VideoRequest>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let input_path = format!("./videos/{}", filename);
    let input_path = "./videos/sample.mp4";

    let video_bitrate = 2000000.0;
    let audio_bitrate = 128000.0;
    //let audio_bitrate = 0.0;

    // Get timestamp from the query parameters or default to 0
    let start_timestamp = params.timestamp.unwrap_or(0.0);

    println!("Start timestamp: {}", start_timestamp);

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
            .args(["-v", "quiet"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &input_path])
            .args(["-t", "10.0"])
            .args(["-c:v", "h264_nvenc"])
            .args(["-preset", "fast"])
            .args(["-b:v", "2M"])
            .args(["-force_key_frames", "expr:gte(t,n_forced*2)"])
            .args(["-c:a", "libopus"])
            .args(["-b:a", "128k"])
            .args(["-movflags", "frag_keyframe+empty_moov"])
            .args(["-f", "mp4"])
            .args(["pipe:1"])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = vec![0; 1024 * 1024 * 12];
            // if let Ok(bytes_read) = stdout.read_exact(&mut read_buf).await {
            //     let mut buffer_writer = buffer_clone.lock().unwrap();
            //     buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
            // } else {
            //     eprintln!("Failed to read FFmpeg stdout");
            // }
            loop {
                match stdout.read(&mut read_buf).await {
                    Ok(0) => break,
                    Ok(bytes_read) => {
                        let mut buffer_writer = buffer_clone.lock().unwrap();
                        buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                        println!("Read {} bytes", bytes_read);
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

    let content_range_header = _headers.get(header::RANGE);
    let requested_content_range = if let Some(content_range_header) = content_range_header {
        parse_content_range(content_range_header.to_str().unwrap())
    } else {
        None
    };

    let response_headers = res.headers_mut();
    response_headers.insert(header::CONTENT_TYPE, "video/mp4".parse().unwrap());
    response_headers.insert(
        header::CONTENT_LENGTH,
        transcoded_size.to_string().parse().unwrap(),
    );

    if let Some(requested_content_range) = requested_content_range {
        println!("Requested content range: {}", requested_content_range);
        response_headers.insert(
            header::CONTENT_RANGE,
            format!(
                "bytes {}-{}/{}",
                requested_content_range,
                requested_content_range + transcoded_size as u64,
                estimated_size as u64
            )
            .parse()
            .unwrap(),
        );
    } else {
        response_headers.insert(
            header::CONTENT_RANGE,
            format!("bytes 0-{}/{}", transcoded_size, estimated_size as u64)
                .parse()
                .unwrap(),
        );
    }
    res
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
