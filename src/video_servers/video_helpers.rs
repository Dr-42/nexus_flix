use serde::Serialize;
use serde_json::Value;
use std::{ffi::OsStr, process::Stdio, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::Mutex,
};

#[derive(Serialize, Debug, PartialEq, Eq)]
pub enum Tracktype {
    Audio,
    Video,
    Subtitle(bool),
}

#[derive(Serialize, Debug)]
pub struct Track {
    pub id: u64,
    pub kind: Tracktype,
    pub label: String,
}

#[derive(Serialize, Debug)]
pub struct VideoMetadata {
    pub duration: f64,
    pub tracks: Vec<Track>,
    pub unavailable_subs: Vec<u64>,
}

pub async fn get_video_metadata(input_path: &str) -> Result<VideoMetadata, String> {
    println!("Input path: {input_path}");
    let output = Command::new("ffprobe")
        .args(["-v", "quiet"])
        .args(["-print_format", "json"])
        .args(["-show_streams"])
        .args([input_path])
        .output()
        .await
        .map_err(|_| "Failed to execute ffprobe")
        .unwrap();

    let stdout = String::from_utf8_lossy(&output.stdout);
    let metadata: Value = serde_json::from_str(&stdout).unwrap();
    let mut tracks: Vec<Track> = Vec::new();

    println!("Metadata: {}", metadata["streams"]);
    let metadata = metadata["streams"].as_array().unwrap();
    let mut audio_idx = -1;
    let mut subtitle_idx = -1;

    let mut unavailable_subs = Vec::new();
    for stream in metadata {
        if let Some(track_type) = stream.get("codec_type") {
            let track_type = match track_type.as_str().unwrap() {
                "audio" => Tracktype::Audio,
                "video" => Tracktype::Video,
                "subtitle" => Tracktype::Subtitle(false),
                _ => continue,
            };
            let track_id = match track_type {
                Tracktype::Audio => {
                    audio_idx += 1;
                    audio_idx
                }
                Tracktype::Video => 0,
                Tracktype::Subtitle(_) => {
                    subtitle_idx += 1;
                    subtitle_idx
                }
            } as u64;
            let tags = stream["tags"].as_object();
            let label = if let Some(tags) = tags {
                if let Some(label) = tags.get("title") {
                    label.as_str().unwrap().to_string()
                } else if let Some(label) = tags.get("language") {
                    label.as_str().unwrap().to_string()
                } else {
                    match track_type {
                        Tracktype::Audio => format!("Audio {track_id}"),
                        Tracktype::Video => format!("Video {track_id}"),
                        Tracktype::Subtitle(_) => format!("Subtitle {track_id}"),
                    }
                }
            } else {
                format!("Track {track_id}")
            };
            if track_type == Tracktype::Subtitle(false) {
                let sub_codec = stream["codec_name"].as_str().unwrap();
                let graphic_codecs = vec!["dvbsub", "dvdsub", "pgs", "xsub"];
                for graphic_codec in graphic_codecs {
                    if sub_codec.contains(graphic_codec) {
                        unavailable_subs.push(track_id);
                    }
                }
            }
            let track = Track {
                id: track_id,
                kind: track_type,
                label,
            };
            tracks.push(track);
        }
    }

    // Check if there exists a subtitle file right beside the video
    let video_path = std::path::Path::new(input_path);
    let video_dir = video_path.parent().unwrap();
    let subtitle_exts = [OsStr::new("srt"), OsStr::new("vtt")];

    for file in video_dir.read_dir().unwrap() {
        let subtitle_path = file.unwrap().path();
        if let Some(ext) = subtitle_path.extension() {
            if !subtitle_exts.contains(&ext) {
                continue;
            }
        } else {
            continue;
        }
        println!("Subtitle path: {}", subtitle_path.display());
        if subtitle_path.exists() {
            subtitle_idx += 1;
            let track = Track {
                id: subtitle_idx as u64,
                kind: Tracktype::Subtitle(true),
                label: subtitle_path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string(),
            };
            tracks.push(track);
        }
    }

    let output = Command::new("ffprobe")
        .args(["-select_streams", "v:0"])
        .args(["-show_entries", "format=duration"])
        .args(["-of", "default=noprint_wrappers=1:nokey=1"])
        .args([input_path])
        .output()
        .await
        .map_err(|_| "Failed to execute ffprobe")
        .unwrap();

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut lines = output_str.lines();
    let duration = lines
        .next()
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap();

    let metadata = VideoMetadata {
        tracks,
        duration,
        unavailable_subs,
    };
    Ok(metadata)
}

#[derive(Default, Debug)]
pub struct AudioData {
    pub id: u64,
    pub data: Vec<u8>,
}

#[derive(Serialize, Debug)]
pub struct SubtitleData {
    pub id: u64,
    pub data: String,
}

#[derive(Default, Debug)]
pub struct VideoResponse {
    pub video_data: Vec<u8>,
    pub audio_data: Vec<AudioData>,
    pub subtitle_data: Vec<SubtitleData>,
}

// NOTE: The binary data is serialized as
// [
//     u32 -> number of audio tracks,
//     u32 -> number of subtitle tracks,
//     u64 -> data length of the video track,
//     Vec<u8> -> video track data,
//     -- For each audio track --
//     u64 -> audio track id,
//     u64 -> data length of the audio track,
//     Vec<u8> -> audio track data,
//     --
// ]
impl VideoResponse {
    pub async fn as_bytes(&self) -> Vec<u8> {
        let mut data = Vec::new();
        data.write_u32_le(self.audio_data.len() as u32)
            .await
            .unwrap();
        data.write_u32_le(self.subtitle_data.len() as u32)
            .await
            .unwrap();
        data.write_u64_le(self.video_data.len() as u64)
            .await
            .unwrap();
        data.write_all(&self.video_data).await.unwrap();
        for audio in &self.audio_data {
            data.write_u64_le(audio.id).await.unwrap();
            data.write_u64_le(audio.data.len() as u64).await.unwrap();
            data.write_all(&audio.data).await.unwrap();
        }
        for subtitle in &self.subtitle_data {
            data.write_u64_le(subtitle.id).await.unwrap();
            data.write_u64_le(subtitle.data.len() as u64).await.unwrap();
            data.write_all(subtitle.data.as_bytes()).await.unwrap();
        }
        data
    }
}

pub async fn get_video_data(
    path: &str,
    start_timestamp: f64,
    duration: Option<f64>,
) -> Result<VideoResponse, String> {
    let video_metadata = get_video_metadata(path).await?;
    let mut video_data = VideoResponse::default();
    let duration = duration.unwrap_or(10.0);
    println!("Duration: {duration}");
    for track in &video_metadata.tracks {
        match track.kind {
            Tracktype::Video => {
                let video_stream = get_video(path, start_timestamp, duration).await;
                video_data.video_data = video_stream;
                println!("Video data: {}", video_data.video_data.len());
            }
            Tracktype::Audio => {
                let audio_stream = get_audio(path, track.id, start_timestamp, duration).await;
                println!("Audio data: {}", audio_stream.data.len());
                video_data.audio_data.push(audio_stream);
            }
            Tracktype::Subtitle(external) => {
                if video_metadata.unavailable_subs.contains(&track.id) {
                    continue;
                }
                let subtitle_stream =
                    get_subtitle(path, track.id, external, start_timestamp, duration).await;
                println!("Subtitle data: {}", subtitle_stream.data.len());
                video_data.subtitle_data.push(subtitle_stream);
            }
        }
    }

    Ok(video_data)
}

async fn get_video(path: &str, start_timestamp: f64, duration: f64) -> Vec<u8> {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();
    let path = Arc::new(path.to_string());
    // Spawn FFmpeg transcoding process
    let handle = tokio::spawn(async move {
        let mut ffmpeg = Command::new("ffmpeg-next")
            .args(["-v", "error"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &path])
            .args(["-t", &duration.to_string()])
            .args(["-c:v", "h264_nvenc"])
            .args(["-crf", "20"])
            .args(["-vf", "scale_cuda=1920:1080:format=yuv420p"])
            .args(["-force_key_frames", "expr:gte(t,n_forced*2)"])
            .args([
                "-movflags",
                "frag_keyframe+empty_moov+faststart+default_base_moof",
            ])
            .args(["-an"])
            .args(["-f", "mp4"])
            .args(["pipe:1"])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = vec![0; 1024 * 1024 * 12];
            loop {
                match stdout.read(&mut read_buf).await {
                    Ok(0) => {
                        break;
                    }
                    Ok(bytes_read) => {
                        let mut buffer_writer = buffer_clone.lock().await;
                        buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                    }
                    Err(e) => {
                        eprintln!("Failed to read FFmpeg stdout: {e}");
                    }
                }
            }
        }
    });
    handle.await.unwrap();
    let buffer_reader = buffer.lock().await;
    buffer_reader.clone()
}

async fn get_audio(path: &str, id: u64, start_timestamp: f64, duration: f64) -> AudioData {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();
    let path = Arc::new(path.to_string());

    // Spawn FFmpeg transcoding process
    let handle = tokio::spawn(async move {
        let mut ffmpeg = Command::new("ffmpeg-next")
            .args(["-v", "error"])
            .args(["-hwaccel", "cuda"])
            .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &path])
            .args(["-t", &duration.to_string()])
            .args(["-c:a", "libfdk_aac"])
            //.args(["-c:a", "libopus"])
            .args(["-ac", "2"])
            .args(["-map", format!("0:a:{id}").as_str()])
            .args(["-force_key_frames", "expr:gte(t,n_forced*2)"])
            .args([
                "-movflags",
                "frag_keyframe+empty_moov+faststart+default_base_moof",
            ])
            .args(["-vn"])
            .args(["-f", "mp4"])
            .args(["pipe:1"])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = vec![0; 1024 * 1024 * 2];
            loop {
                match stdout.read(&mut read_buf).await {
                    Ok(0) => {
                        break;
                    }
                    Ok(bytes_read) => {
                        let mut buffer_writer = buffer_clone.lock().await;
                        buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                    }
                    Err(e) => {
                        eprintln!("Failed to read FFmpeg stdout: {e}");
                    }
                }
            }
        }
    });
    handle.await.unwrap();
    let buffer_reader = buffer.lock().await;
    let data = buffer_reader.clone();
    AudioData { id, data }
}

async fn get_subtitle(
    path: &str,
    id: u64,
    is_external: bool,
    start_timestamp: f64,
    duration: f64,
) -> SubtitleData {
    if is_external {
        let video_path = std::path::Path::new(path);
        let video_directory = video_path.parent().unwrap();
        let mut sub_path = None;
        for file in video_directory.read_dir().unwrap() {
            let file_path = file.unwrap().path();
            if file_path.extension().unwrap() == "srt" {
                sub_path = Some(file_path);
            }
        }
        if sub_path.is_none() {
            return SubtitleData {
                id,
                data: String::new(),
            };
        }
        let sub_path = sub_path.unwrap();
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = buffer.clone();
        let path = Arc::new(sub_path.to_string_lossy().to_string());

        // Spawn FFmpeg transcoding process
        let handle = tokio::spawn(async move {
            let mut ffmpeg = Command::new("ffmpeg-next")
                .args(["-v", "error"])
                .args(["-ss", &start_timestamp.to_string()])
                .args(["-i", &path])
                .args(["-output_ts_offset", &start_timestamp.to_string()])
                .args(["-t", &duration.to_string()])
                .args(["-c:s", "webvtt"])
                .args(["-f", "webvtt"])
                .args(["pipe:1"])
                .stdout(Stdio::piped())
                .spawn()
                .expect("Failed to start FFmpeg");

            if let Some(mut stdout) = ffmpeg.stdout.take() {
                let mut read_buf = vec![0; 1024 * 1024 * 2];
                loop {
                    match stdout.read(&mut read_buf).await {
                        Ok(0) => {
                            break;
                        }
                        Ok(bytes_read) => {
                            let mut buffer_writer = buffer_clone.lock().await;
                            buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                        }
                        Err(e) => {
                            eprintln!("Failed to read FFmpeg stdout: {e}");
                        }
                    }
                }
            }
        });
        handle.await.unwrap();
        let buffer_reader = buffer.lock().await;
        let binary = buffer_reader.clone();

        let data = String::from_utf8_lossy(&binary).to_string();

        SubtitleData { id, data }
    } else {
        let buffer = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = buffer.clone();
        let path = Arc::new(path.to_string());

        // Spawn FFmpeg transcoding process
        let handle = tokio::spawn(async move {
            let mut ffmpeg = Command::new("ffmpeg-next")
                .args(["-v", "error"])
                .args(["-ss", &start_timestamp.to_string()])
                .args(["-i", &path])
                .args(["-output_ts_offset", &start_timestamp.to_string()])
                .args(["-t", &duration.to_string()])
                .args(["-map", format!("0:s:{id}").as_str()])
                .args(["-c:s", "webvtt"])
                .args(["-f", "webvtt"])
                .args(["pipe:1"])
                .stdout(Stdio::piped())
                .spawn()
                .expect("Failed to start FFmpeg");

            if let Some(mut stdout) = ffmpeg.stdout.take() {
                let mut read_buf = vec![0; 1024 * 1024 * 2];
                loop {
                    match stdout.read(&mut read_buf).await {
                        Ok(0) => {
                            break;
                        }
                        Ok(bytes_read) => {
                            let mut buffer_writer = buffer_clone.lock().await;
                            buffer_writer.extend_from_slice(&read_buf[..bytes_read]);
                        }
                        Err(e) => {
                            eprintln!("Failed to read FFmpeg stdout: {e}");
                        }
                    }
                }
            }
        });
        handle.await.unwrap();
        let buffer_reader = buffer.lock().await;
        let binary = buffer_reader.clone();

        let data = String::from_utf8_lossy(&binary).to_string();

        SubtitleData { id, data }
    }
}
