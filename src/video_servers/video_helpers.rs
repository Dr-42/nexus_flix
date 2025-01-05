use serde::Serialize;
use serde_json::Value;
use std::{process::Stdio, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::Mutex,
};

#[derive(Serialize, Debug)]
pub enum Tracktype {
    Audio,
    Video,
    Subtitle,
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
}

pub async fn get_video_metadata(input_path: &str) -> Result<VideoMetadata, String> {
    println!("Input path: {}", input_path);
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

    let metadata = metadata["streams"].as_array().unwrap();
    let mut audio_idx = -1;
    let mut subtitle_idx = -1;

    for stream in metadata {
        if let Some(track_type) = stream.get("codec_type") {
            let track_type = match track_type.as_str().unwrap() {
                "audio" => Tracktype::Audio,
                "video" => Tracktype::Video,
                "subtitle" => Tracktype::Subtitle,
                _ => continue,
            };
            let track_id = match track_type {
                Tracktype::Audio => {
                    audio_idx += 1;
                    audio_idx
                }
                Tracktype::Video => 0,
                Tracktype::Subtitle => {
                    subtitle_idx += 1;
                    subtitle_idx
                }
            } as u64;
            let tags = stream["tags"].as_object();
            let label = if let Some(tags) = tags {
                println!("Tags: {:#?}", tags);
                if let Some(label) = tags.get("title") {
                    label.as_str().unwrap().to_string()
                } else if let Some(label) = tags.get("language") {
                    label.as_str().unwrap().to_string()
                } else {
                    match track_type {
                        Tracktype::Audio => format!("Audio {}", track_id),
                        Tracktype::Video => format!("Video {}", track_id),
                        Tracktype::Subtitle => format!("Subtitle {}", track_id),
                    }
                }
            } else {
                format!("Track {}", track_id)
            };
            let track = Track {
                id: track_id,
                kind: track_type,
                label,
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
    println!("Output: {}", output_str);
    let mut lines = output_str.lines();
    let duration = lines
        .next()
        .and_then(|s| s.trim().parse::<f64>().ok())
        .unwrap();

    let metadata = VideoMetadata { tracks, duration };
    Ok(metadata)
}

#[derive(Default, Debug)]
pub struct AudioData {
    pub id: u64,
    pub data: Vec<u8>,
}

#[derive(Default, Debug)]
pub struct SubtitleData {
    pub id: u64,
    pub data: Vec<u8>,
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
//     -- For each subtitle track --
//     u64 -> subtitle track id,
//     u64 ->  data length of subtitle track
//     Vec<u8> -> subtitle track data,
//     ---
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
            data.write_all(&subtitle.data).await.unwrap();
        }
        data
    }
}

pub async fn get_video_data(path: &str, start_timestamp: f64) -> Result<VideoResponse, String> {
    let video_metadata = get_video_metadata(path).await?;
    let mut video_data = VideoResponse::default();
    let duration = 10.0;
    println!("Duration: {}", duration);
    for track in &video_metadata.tracks {
        match track.kind {
            Tracktype::Video => {
                let video_stream = get_video(path, start_timestamp, duration).await;
                video_data.video_data = video_stream;
                println!("Video data: {}", video_data.video_data.len());
            }
            Tracktype::Audio => {
                let audio_stream = get_audio(path, track.id, start_timestamp, duration).await;
                video_data.audio_data.push(audio_stream);
                println!("Audio data: {}", video_data.audio_data.len());
            }
            Tracktype::Subtitle => {
                let subtitle_stream = get_subtitle(path, track.id, start_timestamp, duration).await;
                video_data.subtitle_data.push(subtitle_stream);
                println!("Subtitle data: {}", video_data.subtitle_data.len());
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
            .args(["-crf", "0"])
            .args(["-vf", "scale_cuda=1080:720:format=yuv420p"])
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
                        eprintln!("Failed to read FFmpeg stdout: {}", e);
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
            .args(["-vn"])
            .args(["-f", "adts"])
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
                        eprintln!("Failed to read FFmpeg stdout: {}", e);
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

async fn get_subtitle(path: &str, id: u64, start_timestamp: f64, duration: f64) -> SubtitleData {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let buffer_clone = buffer.clone();
    let path = Arc::new(path.to_string());

    // Spawn FFmpeg transcoding process
    let handle = tokio::spawn(async move {
        let mut ffmpeg = Command::new("ffmpeg-next")
            .args(["-v", "error"])
            // .args(["-hwaccel", "cuda"])
            // .args(["-hwaccel_output_format", "cuda"])
            .args(["-ss", &start_timestamp.to_string()])
            .args(["-i", &path])
            .args(["-t", &duration.to_string()])
            .args(["-c:s", "webvtt"])
            .args(["-f", "webvtt"])
            .args(["pipe:1"])
            .stdout(Stdio::piped())
            .spawn()
            .expect("Failed to start FFmpeg");

        if let Some(mut stdout) = ffmpeg.stdout.take() {
            let mut read_buf = vec![0; 1024 * 1024];
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
                        eprintln!("Failed to read FFmpeg stdout: {}", e);
                    }
                }
            }
        }
    });
    handle.await.unwrap();
    let buffer_reader = buffer.lock().await;
    let data = buffer_reader.clone();
    SubtitleData { id, data }
}
