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

pub async fn serve_favicon() -> impl IntoResponse {
    let favicon_bytes = include_bytes!("../public/images/favicon.png");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "image/x-icon")
        .body(Body::from(favicon_bytes.as_ref()))
        .unwrap()
}

// JavaScript module serving functions
pub async fn serve_webvtt_parser() -> impl IntoResponse {
    let js_text = include_str!("../public/js/video-player/webvtt-parser.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_video_metadata() -> impl IntoResponse {
    let js_text = include_str!("../public/js/video-player/video-metadata.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_video_response_parser() -> impl IntoResponse {
    let js_text = include_str!("../public/js/video-player/video-response-parser.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_video_player() -> impl IntoResponse {
    let js_text = include_str!("../public/js/video-player/video-player.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_backend_tmdb_api() -> impl IntoResponse {
    let js_text = include_str!("../public/js/api/backend-tmdb-api.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_media_cards() -> impl IntoResponse {
    let js_text = include_str!("../public/js/ui/media-cards.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_search_handler() -> impl IntoResponse {
    let js_text = include_str!("../public/js/ui/search-handler.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_modal_manager() -> impl IntoResponse {
    let js_text = include_str!("../public/js/ui/modal-manager.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_settings_modal() -> impl IntoResponse {
    let js_text = include_str!("../public/js/ui/settings-modal.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_global_settings_modal() -> impl IntoResponse {
    let js_text = include_str!("../public/js/ui/global-settings-modal.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_local_library_manager() -> impl IntoResponse {
    let js_text = include_str!("../public/js/library/local-library-manager.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_page_manager() -> impl IntoResponse {
    let js_text = include_str!("../public/js/pages/page-manager.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_navigation_manager() -> impl IntoResponse {
    let js_text = include_str!("../public/js/navigation/navigation-manager.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_event_handler() -> impl IntoResponse {
    let js_text = include_str!("../public/js/events/event-handler.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_app() -> impl IntoResponse {
    let js_text = include_str!("../public/js/app.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_theme_manager() -> impl IntoResponse {
    let js_text = include_str!("../public/js/themes/theme-manager.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}

pub async fn serve_style() -> impl IntoResponse {
    let index_text = include_str!("../public/css/style.css");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/css")
        .body(Body::new(index_text.to_string()))
        .unwrap()
}
