use serde::Serialize;
use serde_json::Value;
use tokio::process::Command;

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
