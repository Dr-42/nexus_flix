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

macro_rules! add_route {
    ($router:expr, $method:ident, $path:expr, $handler:expr) => {
        $router.route($path, $method($handler))
    };
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
    
    let app = Router::new();
    let app = add_route!(app, get, "/", web_servers::serve_index);
    let app = add_route!(app, get, "/video", video_servers::serve_video);
    let app = add_route!(app, get, "/video-data", video_servers::serve_video_metadata);
    let app = add_route!(app, get, "/file_list", video_servers::serve_file_list);
    let app = add_route!(app, post, "/api/add-media", api_servers::add_media);
    let app = add_route!(app, get, "/api/get-media", api_servers::get_media);
    let app = add_route!(app, get, "/api/keys", get_api_keys);
    // Placeholder image
    let app = add_route!(app, get, "/api/placeholder", tmdb_api::serve_placeholder_image);
    // TMDB API routes
    let app = add_route!(app, get, "/api/tmdb/search", tmdb_api::tmdb_search);
    let app = add_route!(app, get, "/api/tmdb/{media_type}/{id}", tmdb_api::tmdb_details);
    let app = add_route!(app, get, "/api/tmdb/tv/{tv_id}/season/{season_number}", tmdb_api::tmdb_season);
    let app = add_route!(app, get, "/api/tmdb/genres/{media_type}", tmdb_api::tmdb_genres);
    let app = add_route!(app, get, "/api/tmdb/trending/{media_type}/{time_window}", tmdb_api::tmdb_trending);
    let app = add_route!(app, get, "/api/tmdb/discover/{media_type}", tmdb_api::tmdb_discover);
    let app = add_route!(app, get, "/api/tmdb/image/{size}/{*path}", tmdb_api::tmdb_image);
    // Video Player Components
    let app = add_route!(app, get, "/public/js/video-player/webvtt-parser.js", web_servers::serve_webvtt_parser);
    let app = add_route!(app, get, "/public/js/video-player/video-metadata.js", web_servers::serve_video_metadata);
    let app = add_route!(app, get, "/public/js/video-player/video-response-parser.js", web_servers::serve_video_response_parser);
    let app = add_route!(app, get, "/public/js/video-player/video-player.js", web_servers::serve_video_player);
    // API Components
    let app = add_route!(app, get, "/public/js/api/backend-tmdb-api.js", web_servers::serve_backend_tmdb_api);
    // UI Components
    let app = add_route!(app, get, "/public/js/ui/media-cards.js", web_servers::serve_media_cards);
    let app = add_route!(app, get, "/public/js/ui/search-handler.js", web_servers::serve_search_handler);
    let app = add_route!(app, get, "/public/js/ui/modal-manager.js", web_servers::serve_modal_manager);
    let app = add_route!(app, get, "/public/js/ui/settings-modal.js", web_servers::serve_settings_modal);
    let app = add_route!(app, get, "/public/js/ui/global-settings-modal.js", web_servers::serve_global_settings_modal);
    // Library Management
    let app = add_route!(app, get, "/public/js/library/local-library-manager.js", web_servers::serve_local_library_manager);
    // Page Management
    let app = add_route!(app, get, "/public/js/pages/page-manager.js", web_servers::serve_page_manager);
    // Navigation
    let app = add_route!(app, get, "/public/js/navigation/navigation-manager.js", web_servers::serve_navigation_manager);
    // Event Handling
    let app = add_route!(app, get, "/public/js/events/event-handler.js", web_servers::serve_event_handler);
    // Main Application
    let app = add_route!(app, get, "/public/js/app.js", web_servers::serve_app);
    // Theme Management
    let app = add_route!(app, get, "/public/js/themes/theme-manager.js", web_servers::serve_theme_manager);
    // CSS
    let app = add_route!(app, get, "/public/css/style.css", web_servers::serve_style);
    let app = app.layer(Extension(tmdb_api));

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}