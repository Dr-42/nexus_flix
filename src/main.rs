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

// TMDB API routes
async fn tmdb_search(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let query = params.get("query").unwrap_or(&String::new()).clone();
    let media_type = params.get("type").unwrap_or(&"movie".to_string()).clone();
    
    let result = if media_type == "tv" {
        tmdb_api.search_tv(&query).await
    } else {
        tmdb_api.search_movie(&query).await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to perform search on TMDB: {}", e))),
    }
}

async fn tmdb_details(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Path((media_type, id)): axum::extract::Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let append_to_response = params.get("append_to_response").map(|s| s.as_str());
    
    let result = if media_type == "tv" {
        tmdb_api.get_tv_details(&id, append_to_response).await
    } else {
        tmdb_api.get_movie_details(&id, append_to_response).await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch details from TMDB: {}", e))),
    }
}

async fn tmdb_season(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Path((tv_id, season_number)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    match tmdb_api.get_tv_season(&tv_id, &season_number).await {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch season details from TMDB: {}", e))),
    }
}

async fn tmdb_genres(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Path(media_type): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, String)> {
    let result = if media_type == "tv" {
        tmdb_api.get_tv_genres().await
    } else {
        tmdb_api.get_movie_genres().await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch genres from TMDB: {}", e))),
    }
}

async fn tmdb_trending(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Path((media_type, time_window)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    match tmdb_api.get_trending(&media_type, &time_window).await {
        Ok(data) => Ok(Json(data)),
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn tmdb_discover(
    Extension(tmdb_api): Extension<Arc<tmdb_api::TmdbApi>>,
    axum::extract::Path(media_type): axum::extract::Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, axum::http::StatusCode> {
    let mut tmdb_params = std::collections::HashMap::new();
    for (key, value) in params {
        tmdb_params.insert(key, value);
    }
    
    match tmdb_api.discover(&media_type, Some(tmdb_params)).await {
        Ok(data) => Ok(Json(data)),
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
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
        // TMDB API routes
        .route("/api/tmdb/search", get(tmdb_search))
        .route("/api/tmdb/{media_type}/{id}", get(tmdb_details))
        .route("/api/tmdb/tv/{tv_id}/season/{season_number}", get(tmdb_season))
        .route("/api/tmdb/genres/{media_type}", get(tmdb_genres))
        .route("/api/tmdb/trending/{media_type}/{time_window}", get(tmdb_trending))
        .route("/api/tmdb/discover/{media_type}", get(tmdb_discover))
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
