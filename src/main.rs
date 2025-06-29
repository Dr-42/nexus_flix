use axum::{
    routing::{get, post},
    Router,
};
use std::env::args;

mod api_servers;
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
        .route("/video", get(video_servers::serve_video))
        .route("/video-data", get(video_servers::serve_video_metadata))
        .route("/file_list", get(video_servers::serve_file_list))
        .route("/api/add-media", post(api_servers::add_media))
        .route("/api/get-media", get(api_servers::get_media))
        .route("/public/js/script.js", get(web_servers::serve_script))
        .route("/public/css/style.css", get(web_servers::serve_style));

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
