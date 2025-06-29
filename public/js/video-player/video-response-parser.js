/**
 * Binary video response parser for handling video stream data
 */
export class VideoResponseParser {
  constructor(arrayBuffer) {
    this.arrayBuffer = arrayBuffer;
    this.dataView = new DataView(arrayBuffer);
    this.offset = 0;

    // Parsed fields
    this.numAudioTracks = 0;
    this.numSubTracks = 0;
    this.videoData = null;
    this.audioTracks = [];
    this.subtitleTracks = [];
  }

  // Helper method to read a Uint32
  readUint32() {
    const value = this.dataView.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  // Helper method to read a BigUint64 safely
  readBigUint64() {
    if (this.offset + 8 > this.dataView.byteLength) {
      throw new Error(
        `Cannot read BigUint64, insufficient data at offset ${this.offset}`,
      );
    }
    const value = this.dataView.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  // Helper method to read a chunk of data safely
  readBytes(length) {
    if (this.offset + length > this.dataView.byteLength) {
      throw new Error(
        `Cannot read ${length} bytes, only ${this.dataView.byteLength - this.offset} remaining`,
      );
    }
    const value = new Uint8Array(this.arrayBuffer, this.offset, length);
    this.offset += length;
    return value;
  }

  // Main method to parse the binary data
  parse() {
    try {
      // Read and validate the number of audio tracks
      this.numAudioTracks = this.readUint32();
      if (this.numAudioTracks < 0 || this.numAudioTracks > 100) {
        throw new Error(
          `Invalid number of audio tracks: ${this.numAudioTracks}`,
        );
      }
      this.numSubTracks = this.readUint32();
      // Read and validate the video track length
      const videoTrackLength = Number(this.readBigUint64());
      if (
        videoTrackLength <= 0 ||
        videoTrackLength > this.dataView.byteLength
      ) {
        throw new Error(`Invalid video track length: ${videoTrackLength}`);
      }
      this.videoData = this.readBytes(videoTrackLength);

      // Read and store audio tracks
      for (let i = 0; i < this.numAudioTracks; i++) {
        const trackId = this.readBigUint64();
        const trackLength = Number(this.readBigUint64());

        if (trackLength <= 0 || trackLength > this.dataView.byteLength) {
          throw new Error(`Invalid audio track length: ${trackLength}`);
        }
        const trackData = this.readBytes(trackLength);
        this.audioTracks.push({ id: trackId, data: trackData });
      }

      // Read and store subtitle tracks
      for (let i = 0; i < this.numSubTracks; i++) {
        const trackId = this.readBigUint64();
        const trackLength = Number(this.readBigUint64());
        if (trackLength <= 0 || trackLength > this.dataView.byteLength) {
          throw new Error(`Invalid subtitle track length: ${trackLength}`);
        }
        const trackData = this.readBytes(trackLength);
        this.subtitleTracks.push({ id: trackId, data: trackData });
      }

      // Return parsed data
      return {
        numAudioTracks: this.numAudioTracks,
        numSubTracks: this.numSubTracks,
        videoData: this.videoData,
        audioTracks: this.audioTracks,
        subtitleTracks: this.subtitleTracks,
      };
    } catch (error) {
      console.error("Error parsing video data:", error.message);
      throw error;
    }
  }
}

