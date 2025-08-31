use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::time::Duration;
use axum::{
    Json, Extension, response::{Response}, body::Body, http::StatusCode,
};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct TmdbApi {
    client: Client,
    api_key: String,
    base_url: String,
    image_base_url: String,
}

#[derive(Serialize, Deserialize)]
pub struct TmdbResponse {
    pub results: Option<Vec<Value>>,
    #[serde(flatten)]
    pub other: HashMap<String, Value>,
}

impl TmdbApi {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let api_key = env::var("TMDB_API_KEY").expect("TMDB_API_KEY must be set");
        let client = Client::builder().timeout(Duration::from_secs(30)).build()?;

        Ok(TmdbApi {
            client,
            api_key,
            base_url: "https://api.themoviedb.org/3".to_string(),
            image_base_url: "https://image.tmdb.org/t/p".to_string(),
        })
    }

    pub async fn fetch_from_tmdb(
        &self,
        endpoint: &str,
        params: Option<HashMap<String, String>>,
    ) -> Result<Value, reqwest::Error> {
        let url = format!("{}/{}", self.base_url, endpoint);
        let mut query_params = vec![("api_key".to_string(), self.api_key.clone())];

        if let Some(p) = params {
            for (key, value) in p {
                query_params.push((key, value));
            }
        }

        let response = self.client.get(&url).query(&query_params).send().await?;

        response.json().await
    }

    // Convenience methods for common API calls
    pub async fn search_movie(&self, query: &str) -> Result<Value, reqwest::Error> {
        let mut params = HashMap::new();
        params.insert("query".to_string(), query.to_string());
        self.fetch_from_tmdb("search/movie", Some(params)).await
    }

    pub async fn search_tv(&self, query: &str) -> Result<Value, reqwest::Error> {
        let mut params = HashMap::new();
        params.insert("query".to_string(), query.to_string());
        self.fetch_from_tmdb("search/tv", Some(params)).await
    }

    pub async fn get_movie_details(
        &self,
        id: &str,
        append_to_response: Option<&str>,
    ) -> Result<Value, reqwest::Error> {
        let data_dir = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
        let data_path = data_dir.data_dir();
        let metadata_folder = data_path.join("metadata");
        if !metadata_folder.exists() {
            std::fs::create_dir_all(&metadata_folder).unwrap();
        }
        let metadata_file = metadata_folder.join(format!("movie_{}.json", id));
        if metadata_file.exists() {
            let json_data_time = std::fs::metadata(&metadata_file)
                .unwrap()
                .modified()
                .unwrap();
            let age = std::time::SystemTime::now()
                .duration_since(json_data_time)
                .unwrap()
                .as_secs();
            // If the cached data is older than 7 days, refetch
            if age > 7 * 24 * 60 * 60 {
                let mut params = HashMap::new();
                if let Some(append) = append_to_response {
                    params.insert("append_to_response".to_string(), append.to_string());
                }
                let val = self
                    .fetch_from_tmdb(&format!("movie/{}", id), Some(params))
                    .await?;
                let json_data = serde_json::to_string_pretty(&val).unwrap();
                std::fs::write(metadata_file, json_data).unwrap();
                Ok(val)
            } else {
                let json_data = std::fs::read_to_string(&metadata_file).unwrap();
                let val: Value = serde_json::from_str(&json_data).unwrap();
                Ok(val)
            }
        } else {
            let mut params = HashMap::new();
            if let Some(append) = append_to_response {
                params.insert("append_to_response".to_string(), append.to_string());
            }
            let val = self
                .fetch_from_tmdb(&format!("movie/{}", id), Some(params))
                .await?;
            let json_data = serde_json::to_string_pretty(&val).unwrap();
            std::fs::write(metadata_file, json_data).unwrap();
            Ok(val)
        }
    }

    pub async fn get_tv_details(
        &self,
        id: &str,
        append_to_response: Option<&str>,
    ) -> Result<Value, reqwest::Error> {
        let data_dir = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
        let data_path = data_dir.data_dir();
        let metadata_folder = data_path.join("metadata");
        if !metadata_folder.exists() {
            std::fs::create_dir_all(&metadata_folder).unwrap();
        }

        let metadata_file = metadata_folder.join(format!("tv_{}.json", id));
        if metadata_file.exists() {
            let json_data_time = std::fs::metadata(&metadata_file)
                .unwrap()
                .modified()
                .unwrap();
            let age = std::time::SystemTime::now()
                .duration_since(json_data_time)
                .unwrap()
                .as_secs();
            // If the cached data is older than 7 days, refetch
            if age > 7 * 24 * 60 * 60 {
                println!("Refetching TV metadata for ID: {}", id);
                let mut params = HashMap::new();
                if let Some(append) = append_to_response {
                    params.insert("append_to_response".to_string(), append.to_string());
                }
                let val = self
                    .fetch_from_tmdb(&format!("tv/{}", id), Some(params))
                    .await?;
                let json_data = serde_json::to_string_pretty(&val).unwrap();
                std::fs::write(metadata_file, json_data).unwrap();
                Ok(val)
            } else {
                let json_data = std::fs::read_to_string(&metadata_file).unwrap();
                let val: Value = serde_json::from_str(&json_data).unwrap();
                Ok(val)
            }
        } else {
            let mut params = HashMap::new();
            if let Some(append) = append_to_response {
                params.insert("append_to_response".to_string(), append.to_string());
            }
            let val = self
                .fetch_from_tmdb(&format!("tv/{}", id), Some(params))
                .await?;
            let json_data = serde_json::to_string_pretty(&val).unwrap();
            std::fs::write(metadata_file, json_data).unwrap();
            Ok(val)
        }
    }

    pub async fn get_tv_season(
        &self,
        tv_id: &str,
        season_number: &str,
    ) -> Result<Value, reqwest::Error> {
        self.fetch_from_tmdb(&format!("tv/{}/season/{}", tv_id, season_number), None)
            .await
    }

    pub async fn get_movie_genres(&self) -> Result<Value, reqwest::Error> {
        self.fetch_from_tmdb("genre/movie/list", None).await
    }

    pub async fn get_tv_genres(&self) -> Result<Value, reqwest::Error> {
        self.fetch_from_tmdb("genre/tv/list", None).await
    }

    pub async fn get_trending(
        &self,
        media_type: &str,
        time_window: &str,
    ) -> Result<Value, reqwest::Error> {
        self.fetch_from_tmdb(&format!("trending/{}/{}", media_type, time_window), None)
            .await
    }

    pub async fn discover(
        &self,
        media_type: &str,
        params: Option<HashMap<String, String>>,
    ) -> Result<Value, reqwest::Error> {
        self.fetch_from_tmdb(&format!("discover/{}", media_type), params)
            .await
    }

    fn get_image_url(&self, path: &str, size: &str) -> String {
        if path.is_empty() {
            return String::new();
        }
        format!("{}/{}/{}", self.image_base_url, size, path)
    }

    pub async fn get_image(&self, size: &str, path: &str) -> Result<Vec<u8>, reqwest::Error> {
        let data_path = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
        let cache_dir = data_path.cache_dir();
        if !cache_dir.exists() {
            std::fs::create_dir_all(cache_dir).unwrap();
        }

        let image_path = format!(
            "{}/{}_{}",
            cache_dir.display(),
            size,
            path.replace("/", "_")
        );
        if std::path::Path::new(&image_path).exists() {
            Ok(std::fs::read(&image_path).unwrap())
        } else {
            let url = self.get_image_url(path, size);
            let response = self.client.get(&url).send().await?;
            let bytes = response.bytes().await?;
            std::fs::write(&image_path, &bytes).unwrap();
            Ok(bytes.to_vec())
        }
    }

    pub async fn get_placeholder_image(
        &self,
        width: u32,
        height: u32,
        text: &str,
    ) -> Result<Vec<u8>, reqwest::Error> {
        let data_path = directories::ProjectDirs::from("com", "dr42", "nexus").unwrap();
        let cache_dir = data_path.cache_dir();
        if !cache_dir.exists() {
            std::fs::create_dir_all(cache_dir).unwrap();
        }

        let placeholder_path = format!(
            "{}/placeholder_{}x{}_{}.png",
            cache_dir.display(),
            width,
            height,
            text.replace(" ", "-")
        );
        if std::path::Path::new(&placeholder_path).exists() {
            Ok(std::fs::read(&placeholder_path).unwrap())
        } else {
            let url = format!(
                "https://via.placeholder.com/{}x{}?text={}",
                width, height, text
            );
            let response = self.client.get(&url).send().await?;
            let bytes = response.bytes().await?;
            std::fs::write(&placeholder_path, &bytes).unwrap();
            Ok(bytes.to_vec())
        }
    }
}

// TMDB API routes
pub async fn tmdb_search(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let query = params.get("query").unwrap_or(&String::new()).clone();
    let media_type = params.get("type").unwrap_or(&"movie".to_string()).clone();
    
    let result = if media_type == "tv" {
        tmdb_api.search_tv(&query).await
    } else {
        tmdb_api.search_movie(&query).await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to perform search on TMDB: {}", e))),
    }
}

pub async fn tmdb_details(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path((media_type, id)): axum::extract::Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let append_to_response = params.get("append_to_response").map(|s| s.as_str());
    
    let result = if media_type == "tv" {
        tmdb_api.get_tv_details(&id, append_to_response).await
    } else {
        tmdb_api.get_movie_details(&id, append_to_response).await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch details from TMDB: {}", e))),
    }
}

pub async fn tmdb_season(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path((tv_id, season_number)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    match tmdb_api.get_tv_season(&tv_id, &season_number).await {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch season details from TMDB: {}", e))),
    }
}

pub async fn tmdb_genres(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path(media_type): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = if media_type == "tv" {
        tmdb_api.get_tv_genres().await
    } else {
        tmdb_api.get_movie_genres().await
    };
    
    match result {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to fetch genres from TMDB: {}", e))),
    }
}

pub async fn tmdb_trending(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path((media_type, time_window)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match tmdb_api.get_trending(&media_type, &time_window).await {
        Ok(data) => Ok(Json(data)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn tmdb_discover(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path(media_type): axum::extract::Path<String>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut tmdb_params = std::collections::HashMap::new();
    for (key, value) in params {
        tmdb_params.insert(key, value);
    }
    
    match tmdb_api.discover(&media_type, Some(tmdb_params)).await {
        Ok(data) => Ok(Json(data)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn tmdb_image(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Path((size, path)): axum::extract::Path<(String, String)>,
) -> Result<Response, (StatusCode, String)> {
    let path = path.strip_prefix('/').unwrap_or(&path).to_string();
    match tmdb_api.get_image(&size, &path).await {
        Ok(image_data) => {
            let response = Response::builder()
                .header("Content-Type", "image/jpeg")
                .body(Body::from(image_data))
                .unwrap();
            Ok(response)
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch image from TMDB: {}", e),
        )),
    }
}

// Receives width, height, and text as query parameters
// Use tmdb_api.get_placeholder_image to generate the image
pub async fn serve_placeholder_image(
    Extension(tmdb_api): Extension<Arc<TmdbApi>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Response, (StatusCode, String)> {
    let width = params.get("width").and_then(|w| w.parse::<u32>().ok()).unwrap_or(300);
    let height = params.get("height").and_then(|h| h.parse::<u32>().ok()).unwrap_or(450);
    let text = params.get("text").unwrap_or(&"No Image".to_string()).clone();
    match tmdb_api.get_placeholder_image(width, height, &text).await {
        Ok(image_data) => {
            let response = Response::builder()
                .header("Content-Type", "image/png")
                .body(Body::from(image_data))
                .unwrap();
            Ok(response)
        },
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to generate placeholder image: {}", e))),
    }
}
