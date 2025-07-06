use std::path::Path;

use axum::{
    body::Body,
    extract::Query,
    http::status::StatusCode,
    response::{IntoResponse, Response},
};
use hyper::header::{self};
use serde::{Deserialize, Serialize};

mod video_helpers;

#[derive(Deserialize)]
pub struct VideoRequest {
    pub path: String,
    pub timestamp: Option<f64>,
    pub duration: Option<f64>,
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
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::new(format!("Video metadata error: {e}")))
            .unwrap(),
        Ok(data) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::new(serde_json::to_string(&data).unwrap()))
            .unwrap(),
    }
}

pub async fn serve_video(Query(params): Query<VideoRequest>) -> impl IntoResponse {
    let input_path = params.path;
    println!("Input path: {input_path}");

    let video_data = video_helpers::get_video_data(
        &input_path,
        params.timestamp.unwrap_or(0.0),
        params.duration,
    )
    .await;
    match video_data {
        Ok(data) => Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .body(Body::from(data.as_bytes().await))
            .unwrap(),
        Err(e) => {
            println!("Video data error: {e}");
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from(format!("Video data error: {e}")))
                .unwrap()
        }
    }
}

#[derive(Deserialize, Serialize, Clone)]
struct FileData {
    file_name: String,
    file_path: String,
    date_modified: u64,
    mime_type: String,
    file_size: u64,
}

pub async fn serve_file_list() -> impl IntoResponse {
    let series_root = Path::new("/run/media/spandan/Spandy HDD/Series");
    let movies_root = Path::new("/run/media/spandan/Spandy HDD/Movies");

    let all_series_files = get_files(series_root);
    let all_movies_files = get_files(movies_root);

    let mut all_files: Vec<FileData> = Vec::new();
    all_files.extend_from_slice(&all_series_files);
    all_files.extend_from_slice(&all_movies_files);

    let json_data = serde_json::to_string(&all_files).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json_data))
        .unwrap()
}

fn get_files(root: &Path) -> Vec<FileData> {
    let file_sys = walkdir::WalkDir::new(root);
    let file_sys = file_sys.sort_by_file_name();
    let mut files: Vec<FileData> = Vec::new();
    for entry in file_sys {
        let entry = entry.unwrap();
        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry.path().to_string_lossy().to_string();
        let date_modified = entry
            .metadata()
            .unwrap()
            .modified()
            .unwrap()
            .elapsed()
            .unwrap()
            .as_secs();
        let mime_type = match infer::get_from_path(entry.path()) {
            Ok(mime) => {
                if let Some(mime) = mime {
                    mime.mime_type().to_string()
                } else {
                    "application/octet-stream".to_string()
                }
            }
            Err(_) => "application/octet-stream".to_string(),
        };
        let file_size = entry.metadata().unwrap().len();
        files.push(FileData {
            file_name,
            file_path,
            date_modified,
            mime_type,
            file_size,
        });
    }
    files
}
