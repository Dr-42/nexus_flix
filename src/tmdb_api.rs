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
            let json_data = std::fs::read_to_string(&metadata_file).unwrap();
            let val: Value = serde_json::from_str(&json_data).unwrap();
            Ok(val)
        } else {
            let mut params = HashMap::new();
            if let Some(append) = append_to_response {
                params.insert("append_to_response".to_string(), append.to_string());
            }
            let val = self.fetch_from_tmdb(&format!("movie/{}", id), Some(params))
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
            let json_data = std::fs::read_to_string(&metadata_file).unwrap();
            let val: Value = serde_json::from_str(&json_data).unwrap();
            Ok(val)
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
