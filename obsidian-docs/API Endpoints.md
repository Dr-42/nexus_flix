# API Endpoints

Complete reference for all NexusFlix REST API endpoints, including video streaming, metadata management, and static asset serving.

## 🌐 Endpoint Categories

### Core Application Routes
- **Web Interface** - HTML and static assets
- **Video Streaming** - Media playback and metadata
- **Library Management** - Local media database
- **External Integration** - API key distribution

## 📺 Video Streaming Endpoints

### `GET /video`
**Purpose:** Stream video content with real-time transcoding

**Query Parameters:**
```typescript
interface VideoRequest {
    path: string;           // File path to video
    timestamp?: number;     // Start time in seconds (default: 0)
    duration?: number;      // Segment duration (default: 10)
}
```

**Example Request:**
```http
GET /video?path=/media/movies/example.mkv&timestamp=120&duration=30
```

**Response:**
- **Status:** `206 Partial Content`
- **Content-Type:** `application/octet-stream`
- **Body:** Binary video data (MP4 container with H.264 video, AAC audio, WebVTT subtitles)

**Binary Response Format:**
```
[4 bytes] Audio track count (u32 little-endian)
[4 bytes] Subtitle track count (u32 little-endian)
[8 bytes] Video data length (u64 little-endian)
[variable] Video data (MP4)
[per audio track]:
    [8 bytes] Track ID (u64 little-endian)
    [8 bytes] Data length (u64 little-endian)
    [variable] Audio data (AAC/ADTS)
[per subtitle track]:
    [8 bytes] Track ID (u64 little-endian)
    [8 bytes] Data length (u64 little-endian)
    [variable] Subtitle data (WebVTT)
```

**Error Responses:**
```http
500 Internal Server Error
Content-Type: text/plain

Video data error: [error message]
```

### `GET /video-data`
**Purpose:** Extract video metadata without transcoding

**Query Parameters:**
```typescript
interface VideoMetadataRequest {
    path: string;  // File path to analyze
}
```

**Example Request:**
```http
GET /video-data?path=/media/movies/example.mkv
```

**Response:**
```json
{
    "duration": 7200.5,
    "tracks": [
        {
            "id": 0,
            "kind": "Video",
            "label": "Video Track 0"
        },
        {
            "id": 1,
            "kind": "Audio",
            "label": "English (AC3 5.1)"
        },
        {
            "id": 2,
            "kind": "Audio", 
            "label": "Spanish (AAC Stereo)"
        },
        {
            "id": 3,
            "kind": {
                "Subtitle": false
            },
            "label": "English (SRT)"
        }
    ],
    "unavailable_subs": [4, 5]
}
```

**Track Types:**
```typescript
type TrackType = 
    | "Video"
    | "Audio" 
    | { "Subtitle": boolean }; // boolean indicates external file
```

### `GET /file_list`
**Purpose:** Enumerate all media files in configured directories

**Response:**
```json
[
    {
        "file_name": "Movie Title (2023).mkv",
        "file_path": "/media/movies/Movie Title (2023).mkv",
        "date_modified": 1640995200,
        "mime_type": "video/x-matroska",
        "file_size": 8589934592
    },
    {
        "file_name": "Series S01E01.mp4",
        "file_path": "/media/series/Show/Season 1/Series S01E01.mp4", 
        "date_modified": 1640995200,
        "mime_type": "video/mp4",
        "file_size": 2147483648
    }
]
```

## 📚 Library Management Endpoints

### `POST /api/add-media`
**Purpose:** Store media metadata in local database

**Request Body:**
```json
{
    "movies": [
        {
            "id": 12345,
            "title": "Example Movie",
            "poster_path": "/path/to/poster.jpg",
            "backdrop_path": "/path/to/backdrop.jpg",
            "genre_ids": [28, 12, 878],
            "vote_average": 8.5,
            "vote_count": 1500,
            "release_date": "2023-06-15",
            "overview": "An exciting movie about...",
            "adult": false,
            "original_language": "en"
        }
    ],
    "series": [
        {
            "id": 67890,
            "name": "Example Series",
            "poster_path": "/path/to/series-poster.jpg",
            "genre_ids": [18, 9648],
            "vote_average": 9.2,
            "vote_count": 2300,
            "first_air_date": "2023-01-10"
        }
    ],
    "fileDatabase": {
        "movie-12345": "/media/movies/example-movie.mkv",
        "tv-67890": "/media/series/example-series/s01e01.mp4"
    }
}
```

**Response:**
```http
200 OK
Content-Type: text/plain

Added media
```

**Storage Location:**
- **Path:** `~/.local/share/nexus/meta.json`
- **Format:** Pretty-printed JSON

### `GET /api/get-media`
**Purpose:** Retrieve stored media metadata

**Response:**
```json
{
    "movies": [...],
    "series": [...], 
    "fileDatabase": {...}
}
```

**Error Response:**
```http
404 Not Found
Content-Type: text/plain

Metadata file not found.
```

## 🔑 Configuration Endpoints

### `GET /api/keys`
**Purpose:** Provide API keys to frontend

**Response:**
```json
{
    "tmdb_api_key": "your_tmdb_api_key_here",
    "gemini_api_key": "your_gemini_api_key_here"
}
```

**Environment Variables Required:**
- `TMDB_API_KEY` - The Movie Database API key
- `GEMINI_API_KEY` - Google Gemini AI API key

## 🎨 Static Asset Endpoints

### Frontend JavaScript Modules

**Video Player Components:**
- `GET /public/js/video-player/video-player.js` ([[public/js/video-player/video-player|Video Player]])
- `GET /public/js/video-player/video-metadata.js` ([[public/js/video-player/video-metadata|Video Metadata]])
- `GET /public/js/video-player/video-response-parser.js` ([[public/js/video-player/video-response-parser|Video Response Parser]])
- `GET /public/js/video-player/webvtt-parser.js` ([[public/js/video-player/webvtt-parser|WebVTT Parser]])

**API Integration:**
- `GET /public/js/api/tmdb-api.js` ([[public/js/api/tmdb-api|TMDB API]])
- `GET /public/js/api/gemini-api.js` ([[public/js/api/gemini-api|Gemini API]])

**UI Components:**
- `GET /public/js/ui/media-cards.js` ([[public/js/ui/media-cards|Media Cards]])
- `GET /public/js/ui/search-handler.js` ([[public/js/ui/search-handler|Search Handler]])
- `GET /public/js/ui/modal-manager.js` ([[public/js/ui/modal-manager|Modal Manager]])
- `GET /public/js/ui/settings-modal.js` ([[public/js/ui/settings-modal|Settings Modal]])
- `GET /public/js/ui/global-settings-modal.js` ([[public/js/ui/global-settings-modal|Global Settings Modal]])

**Management Systems:**
- `GET /public/js/library/local-library-manager.js` ([[public/js/library/local-library-manager|Local Library Manager]])
- `GET /public/js/pages/page-manager.js` ([[public/js/pages/page-manager|Page Manager]])
- `GET /public/js/navigation/navigation-manager.js` ([[public/js/navigation/navigation-manager|Navigation Manager]])
- `GET /public/js/events/event-handler.js` ([[public/js/events/event-handler|Event Handler]])

**Core Services:**
- `GET /public/js/app.js` ([[public/js/app|App]])
- `GET /public/js/themes/theme-manager.js` ([[public/js/themes/theme-manager|Theme Manager]])

**Styling:**
- `GET /public/css/style.css`

### Web Interface
- `GET /` - Main application HTML

**All static assets return:**
- **Status:** `200 OK`
- **Content-Type:** `application/javascript` or `text/css` or `text/html`
- **Body:** File content (embedded in binary)

## 🔧 Request/Response Patterns

### Error Handling
```typescript
interface ErrorResponse {
    status: number;
    message: string;
    details?: string;
}
```

**Common Error Codes:**
- `404` - File not found or endpoint doesn't exist
- `500` - Server error (FFmpeg failure, file system error)
- `400` - Invalid request parameters

### Content Types
- **Video streaming:** `application/octet-stream`
- **JSON responses:** `application/json`
- **JavaScript modules:** `application/javascript`
- **CSS files:** `text/css`
- **HTML pages:** `text/html`
- **Error messages:** `text/plain`

### CORS and Headers
- **No CORS restrictions** (single-origin application)
- **Cache headers** not set (development-focused)
- **Content-Length** automatically handled by Axum

## 🚀 Performance Considerations

### Video Streaming
- **Partial content support** (HTTP 206) for seeking
- **Streaming response** - data sent as available
- **GPU acceleration** - NVENC/NVDEC for performance
- **Configurable segments** - balance quality vs. latency

### Static Assets
- **Embedded serving** - no file system access needed
- **Memory serving** - assets loaded from binary
- **No caching** - suitable for development

### API Rate Limiting
- **No server-side rate limiting** implemented
- **Client-side rate limiting** for external APIs (TMDB)
- **Async processing** for concurrent requests

---

## Related Documentation
- [[Backend Overview]] - Server implementation details
- [[Video Processing]] - FFmpeg integration specifics
- [[Frontend Overview]] - Client-side API consumption
- [[System Architecture]] - Overall request flow