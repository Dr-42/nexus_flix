use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::time::Duration;

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
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

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

        let response = self
            .client
            .get(&url)
            .query(&query_params)
            .send()
            .await?;

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
        let mut params = HashMap::new();
        if let Some(append) = append_to_response {
            params.insert("append_to_response".to_string(), append.to_string());
        }
        self.fetch_from_tmdb(&format!("movie/{}", id), Some(params))
            .await
    }

    pub async fn get_tv_details(
        &self,
        id: &str,
        append_to_response: Option<&str>,
    ) -> Result<Value, reqwest::Error> {
        let mut params = HashMap::new();
        if let Some(append) = append_to_response {
            params.insert("append_to_response".to_string(), append.to_string());
        }
        self.fetch_from_tmdb(&format!("tv/{}", id), Some(params))
            .await
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

    pub fn get_image_url(&self, path: &str, size: &str) -> String {
        if path.is_empty() {
            return String::new();
        }
        format!("{}/{}{}", self.image_base_url, size, path)
    }

    pub fn get_placeholder_image(&self, width: u32, height: u32, text: &str) -> String {
        format!(
            "https://placehold.co/{}x{}/1f2937/ffffff?text={}",
            width, height, text
        )
    }
}