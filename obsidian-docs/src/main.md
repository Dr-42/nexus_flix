# `main.rs`

**Primary Application Entry Point**

`main.rs` is the central entry point for the NexusFlix application. It initializes the Axum web server, defines all API and file-serving routes, and launches the main asynchronous runtime.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Core Modules|Core Modules]]
- [[#Structs|Structs]]
  - [[#ApiKeys|ApiKeys]]
- [[#Functions|Functions]]
  - [[#get_api_keys|get_api_keys]]
  - [[#main|main]]
- [[#Routing|Routing]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `axum`: For web server implementation, routing, and JSON handling.
- `serde`: For serializing data structures into JSON.
- `std::env`: To access environment variables for API keys.
- `tokio`: As the asynchronous runtime.

## Core Modules

The `main.rs` file orchestrates the application by bringing together functionality from three core modules:

- `api_servers`: Manages backend API endpoints for media management.
- `video_servers`: Handles video streaming, transcoding, and metadata delivery.
- `web_servers`: Serves the frontend application files (HTML, CSS, JavaScript).

```rust
mod api_servers;
mod video_servers;
mod web_servers;
```

---

## Structs

### `ApiKeys`

A simple struct to hold the API keys required for external services. It is designed to be serialized into a JSON object for the frontend.

```rust
#[derive(Serialize)]
struct ApiKeys {
    tmdb_api_key: String,
    gemini_api_key: String,
}
```

- **Fields**:
  - `tmdb_api_key`: Stores the The Movie Database (TMDB) API key.
  - `gemini_api_key`: Stores the Google Gemini API key.

---

## Functions

### `get_api_keys`

An asynchronous function that retrieves API keys from environment variables and returns them as a JSON response.

```rust
async fn get_api_keys() -> Json<ApiKeys> {
    let tmdb_api_key = env::var("TMDB_API_KEY").expect("TMDB_API_KEY must be set");
    let gemini_api_key = env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY must be set");

    let keys = ApiKeys {
        tmdb_api_key,
        gemini_api_key,
    };

    Json(keys)
}
```

- **Behavior**:
  - Reads `TMDB_API_KEY` and `GEMINI_API_KEY` from the environment.
  - Panics if either key is not set, ensuring the application does not run without proper configuration.
  - Wraps the keys in the `ApiKeys` struct and returns it as `Json<ApiKeys>`.

### `main`

The primary asynchronous function that sets up and runs the web server.

```rust
#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let port = if let Some(port) = args().nth(1) {
        port.parse().expect("Invalid port")
    } else {
        3000
    };
    let app = Router::new()
        // ... routes defined here ...
    
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

- **Initialization**:
  - `dotenvy::dotenv().ok()`: Loads environment variables from a `.env` file.
  - **Port Configuration**:
    - Reads the port from the first command-line argument.
    - Defaults to port `3000` if no argument is provided.
  - **Router Setup**:
    - Creates a new `Router` instance.
    - Defines all application routes.
  - **Server Binding**:
    - Binds the TCP listener to `0.0.0.0` on the configured port.
  - **Server Launch**:
    - `axum::serve`: Starts the server and keeps it running to handle incoming requests.

---

## Routing

The `main` function defines a comprehensive set of routes that map HTTP requests to specific handler functions in the `web_servers`, `video_servers`, and `api_servers` modules.

### Core API Routes
- `GET /`: Serves the main `index.html` file.
- `GET /video`: Streams video content.
- `GET /video-data`: Provides video metadata.
- `GET /file_list`: Lists available media files.
- `POST /api/add-media`: Adds new media to the library.
- `GET /api/get-media`: Retrieves media from the library.
- `GET /api/keys`: Exposes API keys to the frontend.

### Frontend Asset Routes
The router also serves all JavaScript components for the frontend application, ensuring that the browser can load the necessary modules for UI, state management, and API interactions. This includes:
- Video player components (`webvtt-parser.js`, `video-player.js`, etc.)
- API handlers (`tmdb-api.js`, `gemini-api.js`)
- UI managers (`media-cards.js`, `modal-manager.js`, etc.)
- Core application logic (`app.js`, `page-manager.js`, etc.)
- CSS styles (`style.css`)

This routing strategy allows the application to function as a single, self-contained server without needing a separate frontend development server.

---

## Related Documentation
- [[Backend Overview]]
- [[api_servers]]
- [[video_servers]]
- [[web_servers]]
