use axum::{
    routing::{get, post},
    Json, Router, Extension,
};
use serde::Serialize;
use std::env;
use std::env::args;
use std::sync::Arc;

mod api_servers;
mod video_servers;
mod web_servers;
mod tmdb_api;

#[derive(Serialize)]
struct ApiKeys {
    tmdb_api_key: String,
}

async fn get_api_keys() -> Json<ApiKeys> {
    let tmdb_api_key = env::var("TMDB_API_KEY").expect("TMDB_API_KEY must be set");

    let keys = ApiKeys { tmdb_api_key };

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
    
    // Initialize TMDB API
    let tmdb_api = Arc::new(tmdb_api::TmdbApi::new().expect("Failed to initialize TMDB API"));
    
    let app = Router::new()
        .route("/", get(web_servers::serve_index))
        .route("/video", get(video_servers::serve_video))
        .route("/video-data", get(video_servers::serve_video_metadata))
        .route("/file_list", get(video_servers::serve_file_list))
        .route("/api/add-media", post(api_servers::add_media))
        .route("/api/get-media", get(api_servers::get_media))
        .route("/api/keys", get(get_api_keys))
        // Placeholder image
        .route("/api/placeholder", get(tmdb_api::serve_placeholder_image))
        // TMDB API routes
        .route("/api/tmdb/search", get(tmdb_api::tmdb_search))
        .route("/api/tmdb/{media_type}/{id}", get(tmdb_api::tmdb_details))
        .route("/api/tmdb/tv/{tv_id}/season/{season_number}", get(tmdb_api::tmdb_season))
        .route("/api/tmdb/genres/{media_type}", get(tmdb_api::tmdb_genres))
        .route("/api/tmdb/trending/{media_type}/{time_window}", get(tmdb_api::tmdb_trending))
        .route("/api/tmdb/discover/{media_type}", get(tmdb_api::tmdb_discover))
        .route("/api/tmdb/image/{size}/{*path}", get(tmdb_api::tmdb_image))
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
            "/public/js/api/backend-tmdb-api.js",
            get(web_servers::serve_backend_tmdb_api),
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
        .route("/public/css/style.css", get(web_servers::serve_style))
        .layer(Extension(tmdb_api));

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
