use axum::{
    body::Body,
    response::{IntoResponse, Response},
};
use hyper::header::{self};

pub async fn serve_index() -> impl IntoResponse {
    let index_text = include_str!("../index.html");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/html")
        .body(Body::new(index_text.to_string()))
        .unwrap()
}
