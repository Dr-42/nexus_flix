use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::env;
use std::env::args;

mod api_servers;
mod video_servers;
mod web_servers;

#[derive(Serialize)]
struct ApiKeys {
    tmdb_api_key: String,
    gemini_api_key: String,
}

async fn get_api_keys() -> Json<ApiKeys> {
    let tmdb_api_key = env::var("TMDB_API_KEY").expect("TMDB_API_KEY must be set");
    let gemini_api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");

    let keys = ApiKeys {
        tmdb_api_key,
        gemini_api_key,
    };

    Json(keys)
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
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
        .route("/api/keys", get(get_api_keys))
        // Video Player Components
        .route(
            "/public/js/video-player/webvtt-parser.js",
            get(web_servers::serve_webvtt_parser),
        )
        .route(
            "/public/js/video-player/video-metadata.js",
            get(web_servers::serve_video_metadata),
        )
        .route(
            "/public/js/video-player/video-response-parser.js",
            get(web_servers::serve_video_response_parser),
        )
        .route(
            "/public/js/video-player/video-player.js",
            get(web_servers::serve_video_player),
        )
        // API Components
        .route(
            "/public/js/api/tmdb-api.js",
            get(web_servers::serve_tmdb_api),
        )
        .route(
            "/public/js/api/gemini-api.js",
            get(web_servers::serve_gemini_api),
        )
        // UI Components
        .route(
            "/public/js/ui/media-cards.js",
            get(web_servers::serve_media_cards),
        )
        .route(
            "/public/js/ui/search-handler.js",
            get(web_servers::serve_search_handler),
        )
        .route(
            "/public/js/ui/modal-manager.js",
            get(web_servers::serve_modal_manager),
        )
        .route(
            "/public/js/ui/settings-modal.js",
            get(web_servers::serve_settings_modal),
        )
        .route(
            "/public/js/ui/global-settings-modal.js",
            get(web_servers::serve_global_settings_modal),
        )
        // Library Management
        .route(
            "/public/js/library/local-library-manager.js",
            get(web_servers::serve_local_library_manager),
        )
        // Page Management
        .route(
            "/public/js/pages/page-manager.js",
            get(web_servers::serve_page_manager),
        )
        // Navigation
        .route(
            "/public/js/navigation/navigation-manager.js",
            get(web_servers::serve_navigation_manager),
        )
        // Event Handling
        .route(
            "/public/js/events/event-handler.js",
            get(web_servers::serve_event_handler),
        )
        // Main Application
        .route("/public/js/app.js", get(web_servers::serve_app))
        // Theme Management
        .route(
            "/public/js/themes/theme-manager.js",
            get(web_servers::serve_theme_manager),
        )
        // CSS
        .route("/public/css/style.css", get(web_servers::serve_style));

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
