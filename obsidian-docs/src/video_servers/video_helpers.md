# `video_helpers.rs`

**Core Video Processing Logic**

`video_helpers.rs` is the engine of the video streaming functionality. It interfaces directly with `ffprobe` and `ffmpeg` to extract video metadata, transcode video and audio streams, and convert subtitles.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Enums|Enums]]
  - [[#Tracktype|Tracktype]]
- [[#Structs|Structs]]
  - [[#Track|Track]]
  - [[#VideoMetadata|VideoMetadata]]
  - [[#AudioData|AudioData]]
  - [[#SubtitleData|SubtitleData]]
  - [[#VideoResponse|VideoResponse]]
- [[#Functions|Functions]]
  - [[#get_video_metadata|get_video_metadata]]
  - [[#get_video_data|get_video_data]]
  - [[#get_video|get_video]]
  - [[#get_audio|get_audio]]
  - [[#get_subtitle|get_subtitle]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `serde` & `serde_json`: For serializing data structures and parsing `ffprobe` output.
- `tokio`: For asynchronous process management and I/O operations.
- `std::process::Stdio`: For piping `ffmpeg` output.

---

## Enums

### `Tracktype`

Represents the type of a media track.

```rust
#[derive(Serialize, Debug, PartialEq, Eq)]
pub enum Tracktype {
    Audio,
    Video,
    Subtitle(bool), // The boolean indicates if it's an external subtitle file
}
```

---

## Structs

### `Track`

Represents a single track within a media file.

```rust
#[derive(Serialize, Debug)]
pub struct Track {
    pub id: u64,
    pub kind: Tracktype,
    pub label: String,
}
```

### `VideoMetadata`

Contains all the metadata for a video file.

```rust
#[derive(Serialize, Debug)]
pub struct VideoMetadata {
    pub duration: f64,
    pub tracks: Vec<Track>,
    pub unavailable_subs: Vec<u64>,
}
```

### `AudioData`

Represents a chunk of audio data.

```rust
#[derive(Default, Debug)]
pub struct AudioData {
    pub id: u64,
    pub data: Vec<u8>,
}
```

### `SubtitleData`

Represents a chunk of subtitle data.

```rust
#[derive(Serialize, Debug)]
pub struct SubtitleData {
    pub id: u64,
    pub data: String,
}
```

### `VideoResponse`

Represents the complete response for a video request, including video, audio, and subtitle data.

```rust
#[derive(Default, Debug)]
pub struct VideoResponse {
    pub video_data: Vec<u8>,
    pub audio_data: Vec<AudioData>,
    pub subtitle_data: Vec<SubtitleData>,
}
```

This struct has a custom `as_bytes` method that serializes the video, audio, and subtitle data into a single byte vector for efficient transport to the client.

---

## Functions

### `get_video_metadata`

Extracts metadata from a video file using `ffprobe`.

- **Behavior**:
  1.  Executes `ffprobe -v quiet -print_format json -show_streams <input_path>`.
  2.  Parses the JSON output to identify all video, audio, and subtitle tracks.
  3.  Detects subtitle tracks that are image-based (e.g., PGS, DVBSUB) and marks them as unavailable for transcoding.
  4.  Scans the video's directory for external subtitle files (`.srt`, `.vtt`) and adds them as available tracks.
  5.  Executes another `ffprobe` command to get the video's duration.
  6.  Returns a `VideoMetadata` struct.

### `get_video_data`

Orchestrates the process of fetching video, audio, and subtitle data for a given time range.

- **Behavior**:
  1.  Calls `get_video_metadata` to get the track information.
  2.  Iterates through the tracks and calls the appropriate function (`get_video`, `get_audio`, or `get_subtitle`) for each one.
  3.  Collects the data into a `VideoResponse` struct.

### `get_video`

Transcodes a segment of the video stream using `ffmpeg`.

- **FFmpeg Command**:
  ```bash
  ffmpeg-next -v error -hwaccel cuda -hwaccel_output_format cuda -ss <start> -i <path> -t <duration> -c:v h264_nvenc -crf 20 -vf scale_cuda=1920:1080:format=yuv420p -force_key_frames "expr:gte(t,n_forced*2)" -movflags frag_keyframe+empty_moov+faststart+default_base_moof -an -f mp4 pipe:1
  ```
- **Key Parameters**:
  - `-hwaccel cuda`: Uses NVIDIA's CUDA for hardware acceleration.
  - `-c:v h264_nvenc`: Encodes the video using the NVIDIA H.264 encoder.
  - `-vf scale_cuda`: Scales the video to 1080p using the GPU.
  - `-movflags frag_keyframe+...`: Creates a fragmented MP4 suitable for streaming.

### `get_audio`

Transcodes a segment of an audio track using `ffmpeg`.

- **FFmpeg Command**:
  ```bash
  ffmpeg-next -v error -hwaccel cuda -hwaccel_output_format cuda -ss <start> -i <path> -t <duration> -c:a libfdk_aac -ac 2 -map 0:a:<id> -movflags frag_keyframe+empty_moov+faststart+default_base_moof -vn -f mp4 pipe:1
  ```
- **Key Parameters**:
  - `-c:a libfdk_aac`: Encodes the audio using the Fraunhofer FDK AAC codec.
  - `-map 0:a:<id>`: Selects the specific audio track.

### `get_subtitle`

Converts a subtitle track (either embedded or external) to the WebVTT format using `ffmpeg`.

- **FFmpeg Command (for embedded subtitles)**:
  ```bash
  ffmpeg-next -v error -ss <start> -i <path> -t <duration> -map 0:s:<id> -c:s webvtt -f webvtt pipe:1
  ```
- **Key Parameters**:
  - `-c:s webvtt`: Converts the subtitle to the WebVTT format.

---

## Related Documentation
- [[video_servers]]
- [[Backend Overview]]
