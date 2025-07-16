# `web_servers.rs`

**Serves Frontend Assets**

`web_servers.rs` is responsible for serving all the static frontend files to the client. This includes the main `index.html` file, all JavaScript modules, and the CSS stylesheet.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Core Design|Core Design]]
- [[#Functions|Functions]]
  - [[#serve_index|serve_index]]
  - [[#javascript-serving-functions|JavaScript-Serving Functions]]
  - [[#serve_style|serve_style]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `axum`: For creating HTTP responses.
- `hyper`: For setting the `Content-Type` header.

---

## Core Design

The primary design pattern in this module is to embed the frontend files directly into the compiled Rust binary using the `include_str!` macro. This approach has several advantages:

- **Single Binary Deployment**: The entire application—backend and frontend—is contained in a single executable file, simplifying deployment.
- **No External Dependencies**: The server does not need to read from the filesystem at runtime to serve these assets, making it more resilient.
- **Performance**: Serving files from memory is typically faster than reading from a disk.

Each function follows the same pattern:
1.  Use `include_str!` to load the file content into a string at compile time.
2.  Create an HTTP response with a `200 OK` status.
3.  Set the appropriate `Content-Type` header (`text/html`, `application/javascript`, or `text/css`).
4.  Return the file content in the response body.

---

## Functions

### `serve_index`

Serves the main `index.html` file.

```rust
pub async fn serve_index() -> impl IntoResponse {
    let index_text = include_str!("../index.html");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/html")
        .body(Body::new(index_text.to_string()))
        .unwrap()
}
```

- **Endpoint**: `GET /`
- **Content-Type**: `text/html`

### JavaScript-Serving Functions

This module contains a dedicated function for each JavaScript file used in the frontend. This modular approach allows the frontend to load components on demand.

**Example: `serve_app`**

```rust
pub async fn serve_app() -> impl IntoResponse {
    let js_text = include_str!("../public/js/app.js");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "application/javascript")
        .body(Body::new(js_text.to_string()))
        .unwrap()
}
```

- **Endpoint**: `GET /public/js/app.js` (and similar for other JS files)
- **Content-Type**: `application/javascript`

**List of Served JavaScript Files**:
- `app.js`
- `api/gemini-api.js`
- `api/tmdb-api.js`
- `events/event-handler.js`
- `library/local-library-manager.js`
- `navigation/navigation-manager.js`
- `pages/page-manager.js`
- `themes/theme-manager.js`
- `ui/global-settings-modal.js`
- `ui/media-cards.js`
- `ui/modal-manager.js`
- `ui/search-handler.js`
- `ui/settings-modal.js`
- `video-player/video-metadata.js`
- `video-player/video-player.js`
- `video-player/video-response-parser.js`
- `video-player/webvtt-parser.js`

### `serve_style`

Serves the main CSS stylesheet.

```rust
pub async fn serve_style() -> impl IntoResponse {
    let index_text = include_str!("../public/css/style.css");
    Response::builder()
        .status(200)
        .header(header::CONTENT_TYPE, "text/css")
        .body(Body::new(index_text.to_string()))
        .unwrap()
}
```

- **Endpoint**: `GET /public/css/style.css`
- **Content-Type**: `text/css`

---

## Related Documentation
- [[main]]
- [[Backend Overview]]
- [[Frontend Overview]]
