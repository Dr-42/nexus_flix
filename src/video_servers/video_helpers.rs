use serde::Serialize;
use serde_json::Value;
use std::io::{self, Write};
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

pub struct AudioData {
    pub id: u64,
    pub data: Vec<u8>,
}

pub struct SubtitleData {
    pub id: u64,
    pub data: Vec<u8>,
}

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
impl Serialize for VideoResponse {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // A helper struct to write binary data to a buffer
        struct BinaryWriter<'a, W: Write> {
            writer: &'a mut W,
        }

        impl<W: Write> BinaryWriter<'_, W> {
            fn write_u32(&mut self, value: u32) -> io::Result<()> {
                self.writer.write_all(&value.to_le_bytes())
            }

            fn write_u64(&mut self, value: u64) -> io::Result<()> {
                self.writer.write_all(&value.to_le_bytes())
            }

            fn write_bytes(&mut self, bytes: &[u8]) -> io::Result<()> {
                self.writer.write_all(bytes)
            }
        }

        let mut buffer = Vec::new();
        {
            let mut writer = BinaryWriter {
                writer: &mut buffer,
            };

            // Write the number of audio and subtitle tracks
            writer
                .write_u32(self.audio_data.len() as u32)
                .map_err(serde::ser::Error::custom)?;
            writer
                .write_u32(self.subtitle_data.len() as u32)
                .map_err(serde::ser::Error::custom)?;

            // Write the video track data
            writer
                .write_u64(self.video_data.len() as u64)
                .map_err(serde::ser::Error::custom)?;
            writer
                .write_bytes(&self.video_data)
                .map_err(serde::ser::Error::custom)?;

            // Write each audio track's data
            for audio in &self.audio_data {
                writer
                    .write_u64(audio.id)
                    .map_err(serde::ser::Error::custom)?;
                writer
                    .write_u64(audio.data.len() as u64)
                    .map_err(serde::ser::Error::custom)?;
                writer
                    .write_bytes(&audio.data)
                    .map_err(serde::ser::Error::custom)?;
            }

            // Write each subtitle track's data
            for subtitle in &self.subtitle_data {
                writer
                    .write_u64(subtitle.id)
                    .map_err(serde::ser::Error::custom)?;
                writer
                    .write_u64(subtitle.data.len() as u64)
                    .map_err(serde::ser::Error::custom)?;
                writer
                    .write_bytes(&subtitle.data)
                    .map_err(serde::ser::Error::custom)?;
            }
        }

        // Use the serializer to encode the binary blob
        serializer.serialize_bytes(&buffer)
    }
}
