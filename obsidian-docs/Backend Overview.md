# Backend Overview

**A high-performance, modular backend for media streaming.**

## Core Philosophy

The backend of NexusFlix is built with Rust and the Axum framework, prioritizing performance, safety, and modularity. The entire backend is compiled into a single binary, which includes all frontend assets, making deployment straightforward.

## Key Components

The backend is divided into three main modules:

- **`main.rs`**: The entry point of the application. It initializes the server, sets up routing, and loads environment variables.
- **`web_servers.rs`**: Responsible for serving the frontend application. It embeds the HTML, CSS, and JavaScript files into the binary and serves them as static assets.
- **`api_servers.rs`**: Manages the media library. It provides endpoints for adding and retrieving media metadata, which is stored in a local `meta.json` file.
- **`video_servers.rs`**: The core of the streaming functionality. It handles video transcoding, metadata extraction, and serving video segments.

## Request Flow

1.  **Client**: The user's browser loads the `index.html` page.
2.  **`web_servers.rs`**: Serves the initial HTML, CSS, and JavaScript files.
3.  **`api_servers.rs`**: The frontend fetches the media library from the `/api/get-media` endpoint.
4.  **`video_servers.rs`**: When the user plays a video:
    - The frontend requests video metadata from `/video-data`.
    - The frontend then requests video segments from `/video`, which are transcoded on the fly by `video_helpers.rs`.

## Video Processing

The video processing pipeline is the most complex part of the backend. It uses `ffmpeg` with NVIDIA hardware acceleration (NVENC/NVDEC) to transcode video and audio streams in real-time. This allows for smooth playback of a wide variety of video formats, even on devices that do not natively support them.

## Data Storage

The application uses a simple file-based storage system for media metadata. A `meta.json` file in the user's data directory stores all the information about the media library. This makes the data portable and easy to manage.

## Related Documentation
- [[main]]
- [[web_servers]]
- [[api_servers]]
- [[video_servers]]
- [[video_helpers]]
