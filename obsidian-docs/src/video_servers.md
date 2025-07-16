# `video_servers.rs`

**Video Streaming and File Management**

`video_servers.rs` is responsible for handling all video-related operations. This includes serving video streams, providing video metadata, and listing available media files from the filesystem.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Modules|Modules]]
- [[#Structs|Structs]]
  - [[#VideoRequest|VideoRequest]]
  - [[#VideoMetadataRequest|VideoMetadataRequest]]
  - [[#FileData|FileData]]
- [[#Functions|Functions]]
  - [[#serve_video_metadata|serve_video_metadata]]
  - [[#serve_video|serve_video]]
  - [[#serve_file_list|serve_file_list]]
  - [[#get_files|get_files]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `axum`: For handling HTTP requests and responses.
- `hyper`: For HTTP headers.
- `serde`: For serializing and deserializing request/response data.
- `walkdir`: For traversing the file system to find media files.
- `infer`: For detecting the MIME type of files.

---

## Modules

- `video_helpers`: This module contains the core logic for video processing, including interacting with FFmpeg to extract metadata and transcode video data.

```rust
mod video_helpers;
```

---

## Structs

### `VideoRequest`

Defines the query parameters for a video streaming request.

```rust
#[derive(Deserialize)]
pub struct VideoRequest {
    pub path: String,
    pub timestamp: Option<f64>,
    pub duration: Option<f64>,
}
```

- **Fields**:
  - `path`: The absolute file path of the video to be streamed.
  - `timestamp`: An optional start time (in seconds) for seeking.
  - `duration`: An optional duration for the video segment.

### `VideoMetadataRequest`

Defines the query parameters for a video metadata request.

```rust
#[derive(Deserialize)]
pub struct VideoMetadataRequest {
    pub path: String,
}
```

- **Fields**:
  - `path`: The absolute file path of the video.

### `FileData`

Represents a single file found on the filesystem.

```rust
#[derive(Deserialize, Serialize, Clone)]
struct FileData {
    file_name: String,
    file_path: String,
    date_modified: u64,
    mime_type: String,
    file_size: u64,
}
```

- **Fields**:
  - `file_name`: The name of the file.
  - `file_path`: The full path to the file.
  - `date_modified`: The last modified timestamp of the file.
  - `mime_type`: The detected MIME type of the file.
  - `file_size`: The size of the file in bytes.

---

## Functions

### `serve_video_metadata`

An asynchronous endpoint that retrieves and returns metadata for a specific video file.

```rust
pub async fn serve_video_metadata(Query(params): Query<VideoMetadataRequest>) -> impl IntoResponse {
    // ... implementation ...
}
```

- **Endpoint**: `GET /video-data`
- **Input**: `Query<VideoMetadataRequest>` - The request containing the video file path.
- **Behavior**:
  1.  Calls `video_helpers::get_video_metadata` to extract metadata using FFprobe.
  2.  If successful, it returns the metadata as a JSON response with an `HTTP 200 OK` status.
  3.  If an error occurs, it returns an `HTTP 500 Internal Server Error` with a descriptive error message.

### `serve_video`

An asynchronous endpoint that serves a segment of a video file, potentially transcoding it on the fly.

```rust
pub async fn serve_video(Query(params): Query<VideoRequest>) -> impl IntoResponse {
    // ... implementation ...
}
```

- **Endpoint**: `GET /video`
- **Input**: `Query<VideoRequest>` - The request containing the video path and optional timestamp/duration.
- **Behavior**:
  1.  Calls `video_helpers::get_video_data` to get the video data.
  2.  If successful, it streams the video data back to the client with an `HTTP 206 Partial Content` status, which is crucial for video seeking.
  3.  If an error occurs, it returns an `HTTP 500 Internal Server Error`.

### `serve_file_list`

An asynchronous endpoint that scans predefined directories for media files and returns a list of them.

```rust
pub async fn serve_file_list() -> impl IntoResponse {
    // ... implementation ...
}
```

- **Endpoint**: `GET /file_list`
- **Behavior**:
  1.  **Hardcoded Paths**: The function currently uses hardcoded paths for the series and movies directories (`/run/media/spandan/Spandy HDD/Series` and `/run/media/spandan/Spandy HDD/Movies`).
  2.  **File Discovery**: It calls the `get_files` function to recursively scan these directories.
  3.  **JSON Response**: It serializes the list of `FileData` objects into a JSON array and returns it with an `HTTP 200 OK` status.

### `get_files`

A synchronous helper function that walks a directory tree and collects information about each file.

```rust
fn get_files(root: &Path) -> Vec<FileData> {
    // ... implementation ...
}
```

- **Input**: `root: &Path` - The root directory to scan.
- **Behavior**:
  1.  Uses `walkdir` to recursively iterate through all files and directories.
  2.  For each entry, it extracts the file name, path, modification date, and size.
  3.  It uses the `infer` crate to determine the MIME type of the file.
  4.  It collects all this information into a `Vec<FileData>`.

---

## Related Documentation
- [[main]]
- [[video_helpers]]
- [[Backend Overview]]
