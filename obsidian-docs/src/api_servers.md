# `api_servers.rs`

**Backend API for Media Management**

`api_servers.rs` provides the core backend endpoints for managing the media library. It handles adding new media metadata to the local database and retrieving it.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Structs|Structs]]
  - [[#Meta|Meta]]
  - [[#MetaData|MetaData]]
- [[#Functions|Functions]]
  - [[#add_media|add_media]]
  - [[#get_media|get_media]]
- [[#Data Storage|Data Storage]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `axum`: For response generation and JSON handling.
- `hyper`: For HTTP status codes and headers.
- `serde` & `serde_json`: For serializing and deserializing JSON data.
- `std::collections::HashMap`: To store the file database.
- `directories`: To locate the appropriate data directory on the user's system.

---

## Structs

### `Meta`

Represents the metadata for a single media item (a movie or a TV series). The fields are largely optional (`Option<T>`) to gracefully handle variations in the data provided by the TMDB API.

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct Meta {
    #[serde(skip_serializing_if = "Option::is_none")]
    adult: Option<bool>,
    backdrop_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre_ids: Option<Vec<u32>>,
    id: u32,
    // ... other fields
}
```

- **Key Attributes**:
  - `id`: A unique identifier from TMDB.
  - `title` / `name`: The title of the media.
  - `poster_path`, `backdrop_path`: URLs for images.
  - `vote_average`, `vote_count`: Rating information.
  - `overview`: A summary of the media.
- **Serialization Behavior**:
  - `#[serde(skip_serializing_if = "Option::is_none")]`: This attribute ensures that `null` values are omitted from the JSON output, keeping the `meta.json` file clean and compact.

### `MetaData`

A top-level struct that organizes the entire media library.

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct MetaData {
    series: Vec<Meta>,
    movies: Vec<Meta>,
    #[serde(rename = "fileDatabase")]
    file_database: HashMap<String, Value>,
}
```

- **Fields**:
  - `series`: A vector of `Meta` objects representing TV series.
  - `movies`: A vector of `Meta` objects representing movies.
  - `file_database`: A `HashMap` that maps a unique media identifier (e.g., `"movie-12345"`) to the local file path of the media.

---

## Functions

### `add_media`

An asynchronous endpoint that receives media metadata from the frontend and saves it to a local `meta.json` file.

```rust
pub async fn add_media(media: Json<MetaData>) -> impl IntoResponse {
    // ... implementation ...
}
```

- **Endpoint**: `POST /api/add-media`
- **Input**: `Json<MetaData>` - The media library data sent from the client.
- **Behavior**:
  1.  **Locate Data Directory**: Uses the `directories` crate to find the appropriate application data directory (e.g., `~/.local/share/nexus/` on Linux).
  2.  **Create Directory**: If the data directory does not exist, it creates it.
  3.  **Serialize Data**: Serializes the incoming `MetaData` struct into a formatted JSON string.
  4.  **Write to File**: Writes the JSON string to `meta.json`, overwriting any existing content.
  5.  **Respond**: Returns an `HTTP 200 OK` status to indicate success.

### `get_media`

An asynchronous endpoint that reads the `meta.json` file and returns its content to the client.

```rust
pub async fn get_media() -> impl IntoResponse {
    // ... implementation ...
}
```

- **Endpoint**: `GET /api/get-media`
- **Behavior**:
  1.  **Locate Metadata File**: Finds the path to `meta.json` in the application data directory.
  2.  **Handle Missing File**: If `meta.json` does not exist, it returns an `HTTP 404 Not Found` response.
  3.  **Read File**: Reads the entire content of the file into a string.
  4.  **Respond**: Returns the JSON data with an `HTTP 200 OK` status and the `Content-Type` header set to `application/json`.

---

## Data Storage

The media library is stored in a single JSON file named `meta.json`. This file is located in a standard user-specific data directory to ensure it persists between application runs.

- **Location (Linux)**: `~/.local/share/nexus/meta.json`
- **Format**: A pretty-printed JSON object representing the `MetaData` struct.

This simple file-based storage mechanism is effective for a personal media server, as it is easy to inspect, backup, and manage.

---

## Related Documentation
- [[main]]
- [[Backend Overview]]
- [[Frontend Overview]]
