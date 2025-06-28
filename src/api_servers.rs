use axum::{
    body::Body,
    response::{IntoResponse, Response},
    Json,
};
use hyper::{header, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug)]
pub struct Meta {
    #[serde(skip_serializing_if = "Option::is_none")]
    adult: Option<bool>,
    backdrop_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre_ids: Option<Vec<u32>>,
    id: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    original_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    original_country: Option<Vec<String>>,
    // Maybe absent in the response
    #[serde(skip_serializing_if = "Option::is_none")]
    original_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    overview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    popularity: Option<f32>,
    poster_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    video: Option<bool>,
    vote_average: f32,
    vote_count: u32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MetaData {
    series: Vec<Meta>,
    movies: Vec<Meta>,
    #[serde(rename = "fileDatabase")]
    file_database: HashMap<String, Value>,
}

pub async fn add_media(media: Json<MetaData>) -> impl IntoResponse {
    println!("{:?}", media);
    let data_path = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
    let data_dir = data_path.data_dir();
    if !data_dir.exists() {
        std::fs::create_dir_all(data_dir).unwrap();
    }
    let metadata_file = data_dir.join("meta.json");
    let media_data = media.0;
    let json_data = serde_json::to_string_pretty(&media_data).unwrap();
    std::fs::write(metadata_file, json_data).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .body(Body::from("Added media"))
        .unwrap()
}

pub async fn get_media() -> impl IntoResponse {
    let data_path = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
    let data_dir = data_path.data_dir();
    let metadata_file = data_dir.join("meta.json");

    if !metadata_file.exists() {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::from("Metadata file not found."))
            .unwrap();
    }

    let json_data = std::fs::read_to_string(metadata_file).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::new(json_data))
        .unwrap()
}
