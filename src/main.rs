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
        // Video Player Components
        .route("/public/js/video-player/webvtt-parser.js", get(web_servers::serve_webvtt_parser))
        .route("/public/js/video-player/video-metadata.js", get(web_servers::serve_video_metadata))
        .route("/public/js/video-player/video-response-parser.js", get(web_servers::serve_video_response_parser))
        .route("/public/js/video-player/video-player.js", get(web_servers::serve_video_player))
        // API Components
        .route("/public/js/api/tmdb-api.js", get(web_servers::serve_tmdb_api))
        .route("/public/js/api/gemini-api.js", get(web_servers::serve_gemini_api))
        // UI Components
        .route("/public/js/ui/media-cards.js", get(web_servers::serve_media_cards))
        .route("/public/js/ui/search-handler.js", get(web_servers::serve_search_handler))
        .route("/public/js/ui/modal-manager.js", get(web_servers::serve_modal_manager))
        // Library Management
        .route("/public/js/library/local-library-manager.js", get(web_servers::serve_local_library_manager))
        // Page Management
        .route("/public/js/pages/page-manager.js", get(web_servers::serve_page_manager))
        // Navigation
        .route("/public/js/navigation/navigation-manager.js", get(web_servers::serve_navigation_manager))
        // Event Handling
        .route("/public/js/events/event-handler.js", get(web_servers::serve_event_handler))
        // Main Application
        .route("/public/js/app.js", get(web_servers::serve_app))
        // CSS
        .route("/public/css/style.css", get(web_servers::serve_style))
        // Test page
        .route("/test", get(web_servers::serve_test_modules));

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
