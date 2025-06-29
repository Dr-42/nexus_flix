/**
 * Video metadata and track handling classes
 */

export class Track {
  constructor(id, kind, label) {
    this.id = id;
    this.kind = kind;
    this.label = label;
  }

  static fromJson(json) {
    return new Track(json.id, json.kind, json.label);
  }

  static fromJsonArray(jsonArray) {
    return jsonArray.map((json) => Track.fromJson(json));
  }
}

export class VideoMetadata {
  constructor(duration, tracks, unavailableSubs) {
    this.duration = duration;
    this.tracks = tracks;
    this.unavailableSubs = unavailableSubs;
  }

  static fromJson(json) {
    const tracks = Track.fromJsonArray(json.tracks);
    const unavailableSubs = json.unavailable_subs;
    return new VideoMetadata(json.duration, tracks, unavailableSubs);
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "Audio");
  }

  getSubtitleTracks() {
    // track.kind is an object in the form { "Subtitle" : true }
    // I dont care about the value
    return this.tracks.filter(
      (track) => typeof track.kind === "object" && "Subtitle" in track.kind,
    );
  }
}

export class FileData {
  constructor(file) {
    this.fileName = file.file_name;
    this.filePath = file.file_path;
    this.dateModified = file.date_modified;
    this.fileSize = file.file_size;
    this.type = file.mime_type;
  }

  static fromJson(json) {
    return new FileData(json);
  }

  static fromJsonArray(jsonArray) {
    return jsonArray.map((json) => FileData.fromJson(json));
  }
}

