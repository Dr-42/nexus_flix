use axum::{
    body::Body,
    extract::Query,
    http::status::StatusCode,
    response::{IntoResponse, Response},
};
use hyper::header::{self};
use serde::Deserialize;

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
            .status(StatusCode::INTERNAL_SERVER_ERROR)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::new(format!("Video metadata error: {}", e)))
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
    println!("Input path: {}", input_path);

    let video_data =
        video_helpers::get_video_data(&input_path, params.timestamp.unwrap_or(0.0)).await;
    match video_data {
        Ok(data) => Response::builder()
            .status(StatusCode::PARTIAL_CONTENT)
            .body(Body::from(data.as_bytes().await))
            .unwrap(),
        Err(e) => {
            println!("Video data error: {}", e);
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from(format!("Video data error: {}", e)))
                .unwrap()
        }
    }
}
