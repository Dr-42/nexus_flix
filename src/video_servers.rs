use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use axum::{
    body::Body,
    extract::Query,
    http::status::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use directories::UserDirs;
use hyper::header::{self};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

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

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub series_root: String,
    pub movies_root: String,
}

fn get_config_path() -> PathBuf {
    let project_dirs = directories::ProjectDirs::from("com", "nexus", "NexusFlix").unwrap();
    let config_dir = project_dirs.config_dir();
    if !config_dir.exists() {
        fs::create_dir_all(config_dir).unwrap();
    }
    config_dir.join("config.json")
}

pub fn load_config() -> Config {
    let config_path = get_config_path();
    if let Ok(mut file) = File::open(config_path) {
        let mut contents = String::new();
        file.read_to_string(&mut contents).unwrap();
        serde_json::from_str(&contents).unwrap()
    } else {
        let user_dirs = UserDirs::new().unwrap();
        let video_dir = user_dirs.video_dir().unwrap_or(user_dirs.home_dir());
        Config {
            series_root: video_dir.to_str().unwrap().to_string(),
            movies_root: video_dir.to_str().unwrap().to_string(),
        }
    }
}

fn save_config(config: &Config) {
    let config_path = get_config_path();
    let mut file = File::create(config_path).unwrap();
    let contents = serde_json::to_string_pretty(config).unwrap();
    file.write_all(contents.as_bytes()).unwrap();
}

pub async fn get_config() -> impl IntoResponse {
    let config = load_config();
    Json(config)
}

pub async fn update_config(Json(new_config): Json<Config>) -> impl IntoResponse {
    save_config(&new_config);
    StatusCode::OK
}

#[derive(Deserialize)]
pub struct BrowseRequest {
    pub path: Option<String>,
}

pub async fn browse(Query(params): Query<BrowseRequest>) -> impl IntoResponse {
    let user_dirs = UserDirs::new().unwrap();
    let path = params
        .path
        .map(PathBuf::from)
        .unwrap_or_else(|| user_dirs.home_dir().to_path_buf());

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(path) {
        for entry in read_dir.filter_map(Result::ok) {
            let path = entry.path();
            let metadata = entry.metadata().ok();
            let is_dir = metadata.map(|m| m.is_dir()).unwrap_or(false);
            entries.push(serde_json::json!({
                "name": path.file_name().unwrap_or_default().to_string_lossy(),
                "path": path.to_string_lossy(),
                "is_dir": is_dir,
            }));
        }
    }
    Json(entries)
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
    let config = load_config();
    let series_root = Path::new(&config.series_root);
    let movies_root = Path::new(&config.movies_root);

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
    let file_sys = WalkDir::new(root);
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
