use axum::{routing::get, Router};
use std::env::args;

mod video_servers;
mod web_servers;

#[tokio::main]
async fn main() {
    let port = if let Some(port) = args().nth(1) {
        port.parse().expect("Invalid port")
    } else {
        3000
    };
    let app = Router::new()
        .route("/", get(web_servers::serve_index))
        .route("/script.js", get(web_servers::serve_script))
        .route("/video", get(video_servers::serve_video_with_timestamp))
        .route("/video-data", get(video_servers::serve_video_data));
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
