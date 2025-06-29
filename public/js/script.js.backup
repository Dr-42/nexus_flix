let localMovies = [];
let localSeries = [];
document.addEventListener("DOMContentLoaded", async () => {
  // --- API & SERVER CONFIG ---
  const TMDB_API_KEY = "cc0737ab5aa6d04d148832d81e90c36e"; // IMPORTANT: Replace with your actual TMDB API key
  const TMDB_BASE_URL = "https://api.themoviedb.org/3";
  const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=`; // Gemini key is handled by the environment

  var localFileDatabase = {}; // { 'movie-123': 'path/to/file.mkv', 'tv-456': { '1-1': 'path/to/S01E01.mkv' } }
  let movieGenres = [];
  let tvGenres = [];
  let nexusPlayer = null; // To hold the custom VideoPlayer instance

  // =================================================================
  // VSERVE PLAYER & RELATED CLASSES (FROM SCRIPT.JS)
  // =================================================================

  class WebVTTParser {
    parse(vttContent) {
      const lines = vttContent.trim().replace(/\r/g, "").split("\n");
      const cues = [];
      let i = 0;
      const timestampToSeconds = (ts) => {
        const parts = ts.split(":");
        let seconds = 0;
        if (parts.length === 3) {
          // HH:MM:SS.ms
          seconds += parseFloat(parts[0]) * 3600;
          seconds += parseFloat(parts[1]) * 60;
          seconds += parseFloat(parts[2]);
        } else {
          // MM:SS.ms
          seconds += parseFloat(parts[0]) * 60;
          seconds += parseFloat(parts[1]);
        }
        return seconds;
      };

      while (i < lines.length) {
        if (lines[i] && lines[i].includes("-->")) {
          const [startTimeStr, endTimeStr] = lines[i].split(" --> ");
          const endTimeFinalStr = endTimeStr.split(" ")[0];

          const startTime = timestampToSeconds(startTimeStr);
          const endTime = timestampToSeconds(endTimeFinalStr);

          let cueText = [];
          i++;
          while (i < lines.length && lines[i]) {
            cueText.push(lines[i]);
            i++;
          }

          if (cueText.length > 0) {
            try {
              cues.push(new VTTCue(startTime, endTime, cueText.join("\n")));
            } catch (e) {
              console.error("Could not create VTTCue:", e);
            }
          }
        }
        i++;
      }
      return { cues: cues };
    }
  }

  class Track {
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

  class VideoMetadata {
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

  class VideoResponseParser {
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

  class FileData {
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

  class VideoPlayer {
    constructor(videoElementId, videoPath) {
      this.videoElementId = videoElementId;
      this.videoElement = document.getElementById(videoElementId);
      this.videoPath = encodeURI(videoPath);
      this.videoMimeType = 'video/mp4 ; codecs="avc1.42E01E"';
      //this.audioMimeType = 'audio/mp4 ; codecs="mp4a.40.2"';
      this.audioMimeType = 'audio/mp4 ; codecs="opus"';
      this.mediaSource = null;
      this.videoSourceBuffer = null;
      this.audioSourceBuffer = null;
      this.isFetching = false;
      this.isSeeking = false;
      this.videoMetadata = null;
      this.player = null;
      this.audioIdx = 0;
      this.subtitleTrackElements = [];
      this.seekDuration = 0;
      this.seekDelay = 500; // in milliseconds
      this.seekTimer = null;

      if ("MediaSource" in window) {
        this.initializeMediaSource();
        this.addEventListeners();
      } else {
        console.error("MediaSource API is not supported in this browser.");
      }
    }

    // Debounce logic for seek actions
    debounceSeek(duration) {
      this.seekDuration += duration;
      if (this.seekTimer) {
        clearTimeout(this.seekTimer);
      }
      this.seekTimer = setTimeout(() => {
        const timeSeek = this.player.currentTime() + this.seekDuration;
        this.isSeeking = true;
        this.player.currentTime(timeSeek);
        this.seekDuration = 0;
        this.seekTimer = null;
        // Fire the timeupdate event and wait for it to update the UI
        this.videoElement.dispatchEvent(new Event("timeupdate"));
      }, this.seekDelay);
    }

    initVideoJs() {
      this.player = videojs(this.videoElementId, {
        html5: {
          nativeAudioTracks: false,
          nativeTextTracks: false,
        },
        controls: true,
        autoplay: true,
        enableSmoothSeeking: true,
        fluid: true,
        nativeControlsForTouch: true,
        playbackRates: [0.5, 1, 1.5, 2],
        nativeControlsForTouch: false,
        controlBar: {
          // Switch between subtitle tracks
          subtitles: {
            default: 0,
          },
          // Switch between audio tracks
          audioTracks: {
            default: 0,
          },
          remainingTimeDisplay: {
            displayNegative: false,
          },
        },
        spatialNavigation: {
          enabled: true,
          horizontalSeek: true,
        },
        userActions: {
          hotkeys: (event) => {
            switch (event.key) {
              case " ":
                // Space: Pause/Resume
                event.preventDefault();
                this.player.paused() ? this.player.play() : this.player.pause();
                break;
              case "ArrowLeft":
                if (event.ctrlKey) {
                  // Ctrl+Left: Go back 10 seconds
                  this.debounceSeek(-10);
                } else if (event.shiftKey) {
                  // Shift+Left: Go back 1 second
                  this.debounceSeek(-1);
                } else {
                  // Left: Go back 5 seconds
                  this.debounceSeek(-5);
                }
                break;
              case "ArrowRight":
                if (event.ctrlKey) {
                  // Ctrl+Right: Go forward 10 seconds
                  this.debounceSeek(10);
                } else if (event.shiftKey) {
                  // Shift+Right: Go forward 1 second
                  this.debounceSeek(1);
                } else {
                  // Right: Go forward 5 seconds
                  this.debounceSeek(5);
                }
                break;
              case "ArrowUp":
                // Up: Increase volume
                this.player.volume(Math.min(this.player.volume() + 0.1, 1));
                break;
              case "ArrowDown":
                // Down: Decrease volume
                this.player.volume(Math.max(this.player.volume() - 0.1, 0));
                break;
              case "f":
                // F: Toggle fullscreen
                if (this.player.isFullscreen()) {
                  this.player.exitFullscreen();
                } else {
                  this.player.requestFullscreen();
                }
                break;
              case "Escape":
                // Esc: Quit fullscreen
                if (this.player.isFullscreen()) {
                  this.player.exitFullscreen();
                }
                break;
              case "a":
                if (event.shiftKey) {
                  // Shift+A: Cycle audio tracks backward
                  this.switchAudioTrackByIndex(-1);
                } else if (event.ctrlKey) {
                  // Ctrl+A: Toggle audio mute
                  this.player.muted(!this.player.muted());
                } else {
                  // A: Cycle audio tracks forward
                  this.switchAudioTrackByIndex(1);
                }
                break;
              case "s":
                if (event.shiftKey) {
                  // Shift+S: Cycle subtitle tracks backward
                  this.switchSubtitleTrackByIndex(-1);
                } else if (event.ctrlKey) {
                  // Ctrl+S: Toggle subtitle visibility
                  this.player
                    .textTracks()
                    .forEach((track) => track.enabled(!track.enabled()));
                } else {
                  // S: Cycle subtitle tracks forward
                  this.switchSubtitleTrackByIndex(1);
                }
                break;
              default:
                break;
            }
          },
        },
      });

      this.player.ready(function () {
        var settings = this.textTrackSettings;
        settings.setValues({
          backgroundColor: "#000",
          backgroundOpacity: "0",
          edgeStyle: "uniform",
        });
        settings.updateDisplay();
      });

      let audioTracks = this.videoMetadata.getAudioTracks();
      console.log(audioTracks);
      for (let i = 0; i < audioTracks.length; i++) {
        const audioTrack = audioTracks[i];
        var vidjsTrack = new videojs.AudioTrack({
          id: audioTrack.id,
          kind: "Audio",
          label: audioTrack.label,
          language: audioTrack.language,
        });
        this.player.audioTracks().addTrack(vidjsTrack);
      }
      var audioTrackList = this.player.audioTracks();
      var self = this;
      audioTrackList.addEventListener("change", async function () {
        for (var i = 0; i < audioTrackList.length; i++) {
          var vidjsAudioTrack = audioTrackList[i];
          if (vidjsAudioTrack.enabled) {
            const newAudioTrackId = self.videoMetadata.getAudioTracks()[i].id;

            // If the selected audio track is different from the current one
            if (newAudioTrackId !== self.audioIdx) {
              self.audioIdx = newAudioTrackId;

              // Clear the audio buffer and refetch audio data
              await self.switchAudioTrack();
            }
            return;
          }
        }

        console.log(`tracks: ${audioTrackList.length}`);
      });
    }

    async switchSubtitleTrackByIndex(direction) {
      // TODO: Implement subtitle track switching
    }

    async switchAudioTrackByIndex(direction) {
      const audioTracks = this.videoMetadata.getAudioTracks();
      const currentIndex = audioTracks.findIndex(
        (track) => track.id === this.audioIdx,
      );
      const newIndex =
        (currentIndex + direction + audioTracks.length) % audioTracks.length;
      const newAudioTrackId = audioTracks[newIndex].id;
      this.audioIdx = newAudioTrackId;
      await this.switchAudioTrack();
    }

    async switchAudioTrack() {
      // Abort any ongoing source buffer operations
      if (this.audioSourceBuffer.updating) {
        await new Promise((resolve) =>
          this.audioSourceBuffer.addEventListener("updateend", resolve, {
            once: true,
          }),
        );
      }

      // Check if there is any buffered range to remove
      const audioBufferedRanges = this.audioSourceBuffer.buffered;
      if (audioBufferedRanges.length > 0) {
        const audioBufferStart = audioBufferedRanges.start(0);
        const audioBufferEnd = audioBufferedRanges.end(
          audioBufferedRanges.length - 1,
        );

        this.audioSourceBuffer.remove(audioBufferStart, audioBufferEnd);

        // Wait for buffer removal to complete
        await new Promise((resolve) =>
          this.audioSourceBuffer.addEventListener("updateend", resolve, {
            once: true,
          }),
        );
      }

      // Clear the video buffer
      const videoBufferedRanges = this.videoSourceBuffer.buffered;
      if (videoBufferedRanges.length > 0) {
        const videoBufferStart = videoBufferedRanges.start(0);
        const videoBufferEnd = videoBufferedRanges.end(
          videoBufferedRanges.length - 1,
        );

        this.videoSourceBuffer.remove(videoBufferStart, videoBufferEnd);

        // Wait for buffer removal to complete
        await new Promise((resolve) =>
          this.videoSourceBuffer.addEventListener("updateend", resolve, {
            once: true,
          }),
        );
      }

      // Reset timestamp offset to current time
      const currentTime = this.videoElement.currentTime;
      let flooredTime = Math.floor(currentTime / 10) * 10;
      this.audioSourceBuffer.timestampOffset = flooredTime;
      this.videoSourceBuffer.timestampOffset = flooredTime;

      // Fetch new audio data for the selected track
      await this.fetchVideoChunk(flooredTime);
      this.videoElement.currentTime = flooredTime + 0.3;
    }

    async initializeMediaSource() {
      this.mediaSource = new MediaSource();
      this.videoElement.src = URL.createObjectURL(this.mediaSource);
      this.mediaSource.addEventListener("sourceopen", async () => {
        await this.loadInitialMetadata();
        this.initVideoJs();
        await this.fetchSubtitles();
        await this.initializeSourceBuffer();
        await this.fetchVideoChunk(0.0);
      });
    }

    addEventListeners() {
      this.videoElement.addEventListener("seeking", async () => {
        let bufferedAreas = {
          currentTime: this.videoElement.currentTime,
          buffered: [],
        };
        let videoBufferedRanges = this.videoSourceBuffer.buffered;
        for (let i = 0; i < videoBufferedRanges.length; i++) {
          const start = videoBufferedRanges.start(i);
          const end = videoBufferedRanges.end(i);
          bufferedAreas.buffered.push({ start: start, end: end });
        }
        this.isSeeking = true;
        if (
          this.videoSourceBuffer &&
          !this.videoSourceBuffer.updating &&
          !this.isFetching
        ) {
          const currentTime = this.videoElement.currentTime;
          this.fetchVideoChunk(currentTime);
        }
      });

      this.videoElement.addEventListener("seeked", () => {
        this.isSeeking = false;
      });

      this.videoElement.addEventListener("timeupdate", async () => {
        if (
          !this.videoSourceBuffer ||
          this.videoSourceBuffer.updating ||
          this.isFetching
        ) {
          return;
        }

        const currentTime = this.videoElement.currentTime;
        const bufferEnd = this.getRelevantBufferEnd();

        if (currentTime >= bufferEnd - 3 || this.isSeeking) {
          const newTime = await this.bufferNextVideoChunk(currentTime);
          if (this.isSeeking) {
            this.isSeeking = false;
            this.videoElement.currentTime = newTime + 0.3;
          }
        }
      });
    }

    async initializeSourceBuffer() {
      this.videoSourceBuffer = this.mediaSource.addSourceBuffer(
        this.videoMimeType,
      );
      this.videoSourceBuffer.mode = "segments";
      this.videoSourceBuffer.addEventListener("error", (e) => {
        console.error("SourceBuffer error:", e);
      });

      const audioSourceBuffer = this.mediaSource.addSourceBuffer(
        this.audioMimeType,
      );
      audioSourceBuffer.mode = "segments";
      audioSourceBuffer.addEventListener("error", (e) => {
        console.error("Audio SourceBuffer error:", e);
      });
      this.audioSourceBuffer = audioSourceBuffer;
    }

    async loadInitialMetadata() {
      const response = await fetch(`/video-data?path=${this.videoPath}`);
      if (!response.ok) throw new Error("Failed to fetch video duration");

      const data = await response.json();
      const videoMetadata = VideoMetadata.fromJson(data);

      this.videoMetadata = videoMetadata;
      this.mediaSource.duration = this.videoMetadata.duration;
    }

    async fetchSubtitles() {
      // Add track fields and subtitle data
      const subtitleTracks = this.videoMetadata.getSubtitleTracks();
      for (let i = 0; i < subtitleTracks.length; i++) {
        if (this.videoMetadata.unavailableSubs.includes(i)) continue;
        const subtitleTrack = subtitleTracks[i];

        let track = this.player.addRemoteTextTrack({
          kind: "subtitles",
          label: subtitleTrack.label,
          srclang: "en",
          //src: url,
        });

        // Store track reference for later updates
        this.subtitleTrackElements.push({ idx: i, element: track });
      }
    }

    async fetchVideoChunk(startTime) {
      if (
        this.isFetching ||
        !this.videoSourceBuffer ||
        this.videoSourceBuffer.updating
      )
        return;

      this.isFetching = true;

      try {
        // Abort any ongoing updates
        if (
          this.videoSourceBuffer.updating ||
          this.audioSourceBuffer.updating
        ) {
          this.videoSourceBuffer.abort();
          this.audioSourceBuffer.abort();
        }

        this.videoSourceBuffer.timestampOffset = startTime;
        this.audioSourceBuffer.timestampOffset = startTime;
        const response = await fetch(
          `/video?path=${this.videoPath}&timestamp=${startTime}&duration=10`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch video chunk");
        }

        const arrayBuffer = await response.arrayBuffer();

        // Parse the binary data using the VideoResponseParser class
        const parser = new VideoResponseParser(arrayBuffer);
        const parsedData = parser.parse();

        // Append the video data to the video source buffer
        if (this.videoSourceBuffer && !this.videoSourceBuffer.updating) {
          this.videoSourceBuffer.appendBuffer(parsedData.videoData);
          await new Promise((resolve) =>
            this.videoSourceBuffer.addEventListener("updateend", resolve, {
              once: true,
            }),
          );
        }

        // Append audio data to the audio source buffer
        if (this.audioSourceBuffer && !this.audioSourceBuffer.updating) {
          this.audioSourceBuffer.appendBuffer(
            parsedData.audioTracks[this.audioIdx].data,
          );
          await new Promise((resolve) =>
            this.audioSourceBuffer.addEventListener("updateend", resolve, {
              once: true,
            }),
          );
        }

        // Append subtitle data to track elements
        for (let i = 0; i < parsedData.numSubTracks; i++) {
          const subtitleTrackData = parsedData.subtitleTracks[i];
          const trackElement = this.subtitleTrackElements.find(
            (track) => track.idx === Number(subtitleTrackData.id),
          );
          let subtitleText = new TextDecoder("utf-8").decode(
            subtitleTrackData.data,
          );
          let vjsTexttracks = this.player.textTracks();
          for (let j = 0; j < vjsTexttracks.length; j++) {
            if (vjsTexttracks[j].label === trackElement.element.label) {
              let vjsTexttrack = vjsTexttracks[j];
              // Remove all existing cues
              while (vjsTexttrack.cues.length > 0) {
                vjsTexttrack.removeCue(vjsTexttrack.cues[0]);
              }
              const parser = new WebVTTParser();
              const subtitleCues = parser.parse(subtitleText, "subtitles");
              for (let k = 0; k < subtitleCues.cues.length; k++) {
                vjsTexttrack.addCue(subtitleCues.cues[k]);
              }
            }
          }
          //URL.revokeObjectURL(trackElement.element.src);
          //trackElement.element.src(URL.createObjectURL(new Blob([subtitleText], { type: 'text/vtt' })));
        }
      } catch (error) {
        console.error("Error fetching video chunk:", error.message);
      } finally {
        this.isFetching = false;
      }
    }

    async bufferNextVideoChunk(currentTime) {
      try {
        if (!this.videoSourceBuffer || !this.audioSourceBuffer) {
          console.error("Source buffers not initialized");
          return;
        }

        const newTime = Math.ceil(currentTime / 10) * 10;

        await this.fetchVideoChunk(newTime);
        return newTime;
      } catch (error) {
        console.error("Error during reload:", error.message);
      }
    }

    getRelevantBufferEnd() {
      let bufferEnd = 0;

      for (let i = 0; i < this.videoSourceBuffer.buffered.length; i++) {
        const start = this.videoSourceBuffer.buffered.start(i);
        const end = this.videoSourceBuffer.buffered.end(i);

        if (start <= this.videoElement.currentTime && end > bufferEnd) {
          bufferEnd = end;
        }
      }

      return bufferEnd;
    }
  }

  // =================================================================
  // MAIN APPLICATION LOGIC
  // =================================================================

  // --- HTML GENERATORS ---
  function createMediaCard(item) {
    const title = item.title || item.name;
    const posterPath = item.poster_path
      ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}`
      : "https://placehold.co/400x600/1f2937/ffffff?text=No+Image";
    const itemType = item.media_type || (item.title ? "movie" : "tv");
    const dbKey = `${itemType}-${item.id}`;
    const isInLocal = !!localFileDatabase[dbKey];

    return `
                <div class="media-card group overflow-hidden relative shadow-lg aspect-[2/3]" data-id="${item.id}" data-type="${itemType}">
                    <img src="${posterPath}" alt="${title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onerror="this.onerror=null;this.src='https://placehold.co/400x600/1f2937/ffffff?text=Image+Error';">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <h4 class="font-bold text-white text-lg drop-shadow-md">${title}</h4>
                        <button class="details-btn mt-2 text-sm bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-md hover:bg-white/30 transition-colors w-full">Details</button>
                    </div>
                    ${isInLocal ? '<div class="local-indicator">In Library</div>' : ""}
                </div>
            `;
  }

  function createFeaturedCard(item) {
    const title = item.title || item.name;
    const backdropPath = item.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}`
      : "https://placehold.co/1280x720/1f2937/ffffff?text=No+Image";
    const itemType = item.media_type || (item.title ? "movie" : "tv");

    return `
                <div class="media-card group overflow-hidden relative shadow-lg aspect-video flex flex-col justify-end p-6" data-id="${item.id}" data-type="${itemType}">
                    <img src="${backdropPath}" alt="${title}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 z-0" onerror="this.onerror=null;this.src='https://placehold.co/1280x720/1f2937/ffffff?text=Image+Error';">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10"></div>
                    <div class="relative z-20">
                        <h2 class="text-4xl font-bold text-white drop-shadow-lg">${title}</h2>
                        <p class="mt-2 max-w-2xl text-gray-200 line-clamp-2">${item.overview}</p>
                        <button class="details-btn mt-4 text-md bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-lg hover:bg-white/30 transition-colors font-semibold">
                            View Details
                        </button>
                    </div>
                </div>
            `;
  }

  // --- API FETCHING WITH RATE LIMITING ---
  const apiQueue = [];
  let isFetching = false;
  const FETCH_DELAY = 2; // ms between calls

  async function processApiQueue() {
    if (apiQueue.length === 0 || isFetching) return;
    isFetching = true;

    const { endpoint, params, resolve, reject } = apiQueue.shift();

    try {
      if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
        throw new Error(
          "TMDB API key is missing. Please add it to the script.",
        );
      }
      const url = new URL(`${TMDB_BASE_URL}/${endpoint}`);
      url.searchParams.append("api_key", TMDB_API_KEY);
      for (const key in params) {
        url.searchParams.append(key, params[key]);
      }
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `TMDB API Error (${response.status}): ${response.statusText}`,
        );
      const data = await response.json();
      resolve(data);
    } catch (error) {
      console.error(`TMDB API Error for endpoint ${endpoint}:`, error);
      reject(error);
    }

    setTimeout(() => {
      isFetching = false;
      processApiQueue();
    }, FETCH_DELAY);
  }

  function fetchFromTMDB(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
      apiQueue.push({ endpoint, params, resolve, reject });
      processApiQueue();
    });
  }

  async function callGeminiAPI(prompt) {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(`Gemini API Error: ${response.statusText}`);
    const result = await response.json();
    if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
      return result.candidates[0].content.parts[0].text;
    } else {
      if (result.promptFeedback && result.promptFeedback.blockReason) {
        throw new Error(
          `Request blocked by Gemini: ${result.promptFeedback.blockReason}`,
        );
      }
      throw new Error("Could not get a valid response from the AI.");
    }
  }

  // --- DYNAMIC CONTENT RENDERING ---
  async function populateGrid(endpoint, gridId, cardCreator, params = {}) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;
    try {
      const data = await fetchFromTMDB(endpoint, params);
      if (data.results.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-[color:var(--text-secondary)]">No results found for the selected criteria.</p>`;
        return;
      }
      grid.innerHTML = data.results.slice(0, 18).map(cardCreator).join("");
      lucide.createIcons();
    } catch (error) {
      console.error(`Failed to load ${gridId}:`, error);
      grid.innerHTML = `<div class="col-span-full text-center text-red-400 p-4 bg-red-900/50 rounded-lg">
                    <p class="font-semibold">Error loading content.</p>
                    <p class="text-sm">${error.message}</p>
                </div>`;
    }
  }

  async function loadDashboard() {
    await populateGrid("trending/all/day", "featured-grid", createFeaturedCard);
    await populateGrid("trending/all/week", "popular-grid", createMediaCard);
    await populateGrid("discover/tv", "anime-grid", createMediaCard, {
      with_genres: "16",
      with_keywords: "210024", // Specific keyword for anime
      sort_by: "popularity.desc",
    });
  }

  async function loadAllContent() {
    loadDashboard();
    loadMoviesPage();
    loadSeriesPage();
  }

  // --- SEARCH HANDLING ---
  const searchInput = document.getElementById("search-input");
  const searchResultsContainer = document.getElementById("search-results");
  const pageContentWrapper = document.getElementById("page-content-wrapper");

  let searchTimeout;

  searchInput.addEventListener("keyup", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length > 2) {
      searchResultsContainer.innerHTML = `<div class="flex justify-center items-center h-40"><div class="loader"></div></div>`;
      pageContentWrapper.classList.add("hidden");
      searchResultsContainer.classList.remove("hidden");
      searchTimeout = setTimeout(() => performSearch(query), 500);
    } else {
      searchResultsContainer.innerHTML = "";
      pageContentWrapper.classList.remove("hidden");
      searchResultsContainer.classList.add("hidden");
    }
  });

  async function performSearch(query) {
    try {
      // Search TMDB
      const tmdbMoviesPromise = fetchFromTMDB("search/movie", { query });
      const tmdbSeriesPromise = fetchFromTMDB("search/tv", { query });

      // Search Local Library
      const localMovieResults = localMovies.filter((m) =>
        m.title.toLowerCase().includes(query.toLowerCase()),
      );
      const localSeriesResults = localSeries.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()),
      );

      const [tmdbMovies, tmdbSeries] = await Promise.all([
        tmdbMoviesPromise,
        tmdbSeriesPromise,
      ]);
      const tmdbResults = [...tmdbMovies.results, ...tmdbSeries.results].sort(
        (a, b) => b.popularity - a.popularity,
      );

      let resultsHTML = "";

      // Display local results first
      if (localMovieResults.length > 0 || localSeriesResults.length > 0) {
        resultsHTML += `<h3 class="text-2xl font-bold mb-4 pl-2">In Your Library</h3>`;
        resultsHTML +=
          '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">';
        resultsHTML += [...localMovieResults, ...localSeriesResults]
          .map(createMediaCard)
          .join("");
        resultsHTML += "</div>";
      }

      // Display TMDB results
      if (tmdbResults.length > 0) {
        resultsHTML += `<h3 class="text-2xl font-bold mt-8 mb-4 pl-2">TMDB Results</h3>`;
        resultsHTML +=
          '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">';
        resultsHTML += tmdbResults.slice(0, 18).map(createMediaCard).join("");
        resultsHTML += "</div>";
      }

      if (resultsHTML === "") {
        searchResultsContainer.innerHTML = `<div class="text-center p-8 text-[color:var(--text-secondary)]">No results found for "${query}".</div>`;
      } else {
        searchResultsContainer.innerHTML = resultsHTML;
      }
      lucide.createIcons();
    } catch (error) {
      searchResultsContainer.innerHTML = `<div class="text-center p-8 text-red-400">Error during search: ${error.message}</div>`;
    }
  }

  // --- MODAL AND TMDB CHANGE HANDLING ---
  const modal = document.getElementById("details-modal");
  const modalContent = document.getElementById("modal-content");

  function showModal() {
    modal.classList.add("visible");
  }
  function hideModal() {
    modal.classList.remove("visible");
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest(".modal-close-btn") || e.target === modal) {
      hideModal();
    }
  });

  async function performTmdbChangeSearch(query, type, oldId) {
    const resultsContainer = document.getElementById("tmdb-change-results");
    resultsContainer.innerHTML = `<div class="flex justify-center items-center h-20"><div class="loader"></div></div>`;

    try {
      const data = await fetchFromTMDB(`search/${type}`, { query });
      if (data.results.length === 0) {
        resultsContainer.innerHTML = `<p class="text-center text-[color:var(--text-secondary)]">No results found.</p>`;
        return;
      }

      resultsContainer.innerHTML = data.results
        .map((result) => {
          const title = result.title || result.name;
          const year = (
            result.release_date ||
            result.first_air_date ||
            ""
          ).substring(0, 4);
          const posterPath = result.poster_path
            ? `${TMDB_IMAGE_BASE_URL}/w92${result.poster_path}`
            : "https://placehold.co/92x138/1f2937/ffffff?text=N/A";

          return `
                        <div class="flex items-center gap-4 p-2 rounded-lg bg-[color:var(--bg-tertiary)]">
                            <img src="${posterPath}" class="w-12 h-auto rounded" onerror="this.onerror=null;this.src='https://placehold.co/92x138/1f2937/ffffff?text=N/A';">
                            <div class="flex-grow">
                                <p class="font-semibold">${title}</p>
                                <p class="text-sm text-[color:var(--text-secondary)]">${year}</p>
                            </div>
                            <button class="select-new-tmdb-btn px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm" data-new-id="${result.id}" data-old-id="${oldId}" data-type="${type}">
                                Select
                            </button>
                        </div>
                    `;
        })
        .join("");
    } catch (error) {
      resultsContainer.innerHTML = `<p class="text-center text-red-400">Error during search: ${error.message}</p>`;
    }
  }

  async function showDetails(itemId, itemType) {
    showModal();
    modalContent.innerHTML = `<div class="flex justify-center items-center h-96"><div class="loader"></div></div>`;
    const dbKey = `${itemType}-${itemId}`;
    // The 'localFiles' variable is still useful for other parts of the function, like the play button.
    const localFiles = localFileDatabase[dbKey];

    try {
      const item = await fetchFromTMDB(`${itemType}/${itemId}`, {
        append_to_response: "credits,videos,recommendations",
      });
      const title = item.title || item.name;
      const backdropPath = item.backdrop_path
        ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}`
        : "";
      const posterPath = item.poster_path
        ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}`
        : "https://placehold.co/400x600/1f2937/ffffff?text=No+Image";

      let seasonsHTML = "";
      if (itemType === "tv" && item.seasons) {
        const seasonPromises = item.seasons
          .filter((s) => s.season_number > 0 && s.episode_count > 0) // Exclude "Specials" and empty seasons
          .map((s) => fetchFromTMDB(`tv/${itemId}/season/${s.season_number}`));
        const seasonsDetails = await Promise.all(seasonPromises);

        seasonsHTML =
          `<div class="space-y-2 mt-4">` +
          seasonsDetails
            .map((season) => {
              if (!season || !season.episodes) return "";
              return `
                        <div>
                            <button class="season-accordion-btn flex justify-between items-center">
                                <span>${season.name}</span>
                                <i data-lucide="chevron-down" class="w-5 h-5 transition-transform"></i>
                            </button>
                            <div class="episode-list bg-black/20 p-2 rounded-b-lg">
                                <ul class="space-y-2">
                                    ${season.episodes
                                      .map((ep) => {
                                        const episodeFile = localFiles
                                          ? localFiles[
                                              `${season.season_number}-${ep.episode_number}`
                                            ]
                                          : null;
                                        return `
                                        <li class="p-2 flex justify-between items-center rounded-md hover:bg-black/20">
                                            <div class="flex-1 mr-4">
                                                <span class="font-bold">${ep.episode_number}. ${ep.name}</span>
                                                <p class="text-xs text-gray-400 mt-1 line-clamp-2">${ep.overview}</p>
                                            </div>
                                            <button class="play-episode-btn flex-shrink-0 px-3 py-1 rounded ${episodeFile ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 cursor-not-allowed"}" ${episodeFile ? `data-path="${episodeFile}"` : "disabled"}>Play</button>
                                        </li>
                                        `;
                                      })
                                      .join("")}
                                </ul>
                            </div>
                        </div>
                       `;
            })
            .join("") +
          `</div>`;
      }

      modalContent.innerHTML = `
                <div class="relative">
                    <button class="modal-close-btn"><i data-lucide="x" class="w-6 h-6"></i></button>
                    <img src="${backdropPath}" class="w-full h-48 md:h-80 object-cover" onerror="this.style.display='none'">
                    <div class="absolute inset-0 bg-gradient-to-t from-[color:var(--bg-secondary)] via-[color:var(--bg-secondary)]/70 to-transparent"></div>
                </div>

                <div id="details-view" class="p-6 space-y-6 -mt-24 relative">
                    <div class="flex flex-col md:flex-row gap-6">
                        <img src="${posterPath}" class="w-1/3 max-w-[200px] h-auto rounded-lg shadow-2xl self-center md:self-start" onerror="this.onerror=null;this.src='https://placehold.co/400x600/1f2937/ffffff?text=No+Image';">
                        <div class="flex-1 pt-8">
                            <h2 class="text-3xl lg:text-4xl font-bold text-[color:var(--text-primary)]">${title}</h2>
                            <div class="flex items-center gap-4 mt-2 text-[color:var(--text-secondary)]">
                                <span>${(item.release_date || item.first_air_date || "").substring(0, 4)}</span>
                                <span class="flex items-center gap-1"><i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current"></i> ${item.vote_average.toFixed(1)}</span>
                                ${item.number_of_seasons ? `<span>${item.number_of_seasons} Seasons</span>` : ""}
                            </div>
                            <div class="flex flex-wrap gap-2 mt-4">
                                ${item.genres.map((g) => `<span class="px-3 py-1 text-xs rounded-full bg-[color:var(--bg-tertiary)]">${g.name}</span>`).join("")}
                            </div>
                            ${localFiles && itemType === "movie" ? `<button class="play-movie-btn mt-4 w-full px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:opacity-90 transition-opacity" data-path="${localFiles}">Play Movie</button>` : ""}
                        </div>
                    </div>

                    <div>
                        <h3 class="font-semibold text-lg mb-2">Overview</h3>
                        <p class="text-[color:var(--text-secondary)] leading-relaxed">${item.overview}</p>
                        <div id="ai-synopsis-area" class="mt-4"></div>
                        ${seasonsHTML}
                    </div>

                    <div class="flex flex-wrap gap-4">
                        <button id="ai-synopsis-btn" class="flex-1 px-4 py-2 rounded-lg bg-[color:var(--accent-secondary)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait">✨ Get AI Synopsis</button>
                        ${
                          /* CORRECTED LOGIC: Check the database directly at the moment of rendering. */
                          localFileDatabase[`${itemType}-${item.id}`]
                            ? `<button id="change-tmdb-btn" data-id="${item.id}" data-type="${itemType}" data-title="${title.replace(/"/g, "&quot;")}" class="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:opacity-90 transition-opacity">🔄 Change TMDB Match</button>`
                            : ""
                        }
                    </div>

                    <div id="similar-section" class="pt-6 border-t border-[color:var(--border-color)]">
                        ${
                          item.recommendations?.results.length > 0
                            ? `
                            <h3 class="font-semibold text-lg mb-4">Similar Titles</h3>
                            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">${item.recommendations.results.slice(0, 6).map(createMediaCard).join("")}</div>
                        `
                            : `<p class="text-center text-[color:var(--text-secondary)]">No similar titles found.</p>`
                        }
                    </div>
                </div>
                <div id="tmdb-change-interface" class="hidden p-6 space-y-4">
                    </div>
            `;
      lucide.createIcons();
    } catch (error) {
      console.error(`Failed to load details for ${itemType}/${itemId}:`, error);
      modalContent.innerHTML = `<div class="p-6 text-center text-red-400">Error loading details. ${error.message}</div>`;
    }
  }

  // --- LOCAL MEDIA HANDLING ---
  const importLibraryBtn = document.getElementById("import-library-btn");
  const localStatus = document.getElementById("local-status");
  const localMediaGrid = document.getElementById("local-media-grid");
  const libraryTabs = document.getElementById("library-tabs");

  importLibraryBtn.addEventListener("click", async () => {
    const response = await fetch(`/file_list`);
    if (!response.ok) throw new Error("Failed to fetch files");

    const files = await response.json();
    const fileData = FileData.fromJsonArray(files);
    handleLibrarySelection(fileData);
  });
  libraryTabs.addEventListener("click", (e) => {
    if (e.target.classList.contains("library-tab")) {
      libraryTabs.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
      renderLocalMedia();
    }
  });

  async function handleLibrarySelection(allFiles) {
    if (!allFiles || allFiles.length === 0) return;

    const files = Array.from(allFiles);

    localStatus.innerHTML = `
              <div class="p-4 bg-[color:var(--bg-tertiary)] rounded-lg">
                  <div class="flex items-center gap-4">
                      <div class="loader"></div>
                      <p>Analyzing folder structure and matching files... This may take a moment for large libraries.</p>
                  </div>
              </div>`;

    const moviesToProcess = new Map();
    const seriesToProcess = new Map();

    for (const file of files) {
      const filePath = file.filePath;
      const pathParts = filePath.split("/").filter(Boolean);
      if (pathParts.length < 2) continue;

      while (pathParts.length > 2) {
        if (
          pathParts[0].toLowerCase() === "movies" ||
          pathParts[0].toLowerCase() === "series"
        ) {
          break;
        } else {
          pathParts.shift();
        }
      }

      const typeFolder = pathParts[0].toLowerCase();
      const titleFolder = pathParts[1];

      let collection;
      if (typeFolder === "movies") {
        collection = moviesToProcess;
      } else if (
        typeFolder === "series" ||
        typeFolder === "tv" ||
        typeFolder === "tv shows"
      ) {
        collection = seriesToProcess;
      } else {
        continue;
      }

      if (!collection.has(titleFolder)) {
        collection.set(titleFolder, []);
      }
      collection.get(titleFolder).push(file);
    }

    const moviePromises = Array.from(moviesToProcess.entries()).map(
      async ([title, files]) => {
        const mediaInfo = await searchAndFetchFirstResult(title, "movie");
        if (!mediaInfo) return null;

        const videoFiles = files.filter((f) => f.type.startsWith("video/"));
        if (videoFiles.length === 0) return null;

        const largestVideo = videoFiles.reduce((largest, current) =>
          current.fileSize > largest.fileSize ? current : largest,
        );
        localFileDatabase[`movie-${mediaInfo.id}`] = largestVideo.filePath;
        return mediaInfo;
      },
    );

    const seriesPromises = Array.from(seriesToProcess.entries()).map(
      async ([title, files]) => {
        const mediaInfo = await searchAndFetchFirstResult(title, "tv");
        if (!mediaInfo) return null;

        const episodeRegex = /S(\d{1,2})E(\d{1,3})/i;
        localFileDatabase[`tv-${mediaInfo.id}`] = {};

        for (const file of files) {
          const match = file.fileName.match(episodeRegex);
          if (match) {
            const seasonNum = parseInt(match[1], 10);
            const episodeNum = parseInt(match[2], 10);
            localFileDatabase[`tv-${mediaInfo.id}`][
              `${seasonNum}-${episodeNum}`
            ] = file.filePath;
          }
        }
        return mediaInfo;
      },
    );

    const [movieResults, seriesResults] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(seriesPromises),
    ]);

    const newMovies = movieResults
      .filter(Boolean)
      .filter(
        (newItem) =>
          !localMovies.some((existing) => existing.id === newItem.id),
      );
    const newSeries = seriesResults
      .filter(Boolean)
      .filter(
        (newItem) =>
          !localSeries.some((existing) => existing.id === newItem.id),
      );

    localMovies = [...localMovies, ...newMovies];
    localSeries = [...localSeries, ...newSeries];

    const storageData = {
      movies: localMovies,
      series: localSeries,
      fileDatabase: localFileDatabase,
    };

    await fetch("/api/add-media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(storageData),
    });

    renderLocalMedia();
    loadAllContent();

    localStatus.innerHTML = `
              <div class="p-4 bg-green-900/50 text-green-300 rounded-lg">
                  <p>Import complete. Added ${newMovies.length} movies and ${newSeries.length} series to your library.</p>
              </div>`;

    setTimeout(() => {
      localStatus.innerHTML = "";
    }, 6000);
  }

  async function searchAndFetchFirstResult(query, type) {
    try {
      const searchResults = await fetchFromTMDB(`search/${type}`, {
        query,
      });
      if (searchResults.results && searchResults.results.length > 0) {
        return searchResults.results[0];
      }
      console.warn(`No TMDB results found for query: "${query}"`);
      return null;
    } catch (error) {
      console.error(`Failed to fetch details for "${query}":`, error);
      return null;
    }
  }

  function renderLocalMedia() {
    const activeTab = libraryTabs.querySelector(".active");
    if (!activeTab) return;

    const filter = activeTab.dataset.filter;
    let mediaToRender = [];

    if (filter === "all") {
      mediaToRender = [...localMovies, ...localSeries];
    } else if (filter === "movie") {
      mediaToRender = localMovies;
    } else if (filter === "tv") {
      mediaToRender = localSeries;
    }

    const sortBy = document.getElementById("local-library-sort-by").value;
    const sortedMedia = sortLocalMedia(mediaToRender, sortBy);

    if (sortedMedia.length > 0) {
      localMediaGrid.innerHTML = sortedMedia.map(createMediaCard).join("");
    } else {
      localMediaGrid.innerHTML = `<p class="col-span-full text-[color:var(--text-secondary)]">No local media of this type. Use the import button to add some.</p>`;
    }
    lucide.createIcons();
  }

  // --- PAGE-SPECIFIC LOADING (MOVIES & SERIES with FILTERS) ---

  function sortLocalMedia(mediaArray, sortBy) {
    return [...mediaArray].sort((a, b) => {
      switch (sortBy) {
        case "release_date.desc":
        case "first_air_date.desc":
          const dateA = new Date(a.release_date || a.first_air_date);
          const dateB = new Date(b.release_date || b.first_air_date);
          return dateB - dateA;
        case "vote_average.desc":
          return b.vote_average - a.vote_average;
        case "title.asc":
          const titleA = a.title || a.name || "";
          const titleB = b.title || b.name || "";
          return titleA.localeCompare(titleB);
        case "popularity.desc":
        default:
          return b.popularity - a.popularity;
      }
    });
  }

  async function loadMoviesPage() {
    const grid = document.getElementById("movies-grid");
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;

    const inLibraryFilterBtn = document.getElementById(
      "movies-in-library-filter",
    );
    const inLibraryOnly = inLibraryFilterBtn.dataset.active === "true";
    const genre = document.getElementById("movies-genre-filter").value;
    const sortBy = document.getElementById("movies-sort-by").value;

    if (inLibraryOnly) {
      let movies = localMovies;
      if (genre) {
        movies = movies.filter((m) => m.genre_ids.includes(parseInt(genre)));
      }
      const sortedMovies = sortLocalMedia(movies, sortBy);
      grid.innerHTML =
        sortedMovies.length > 0
          ? sortedMovies.map(createMediaCard).join("")
          : `<p class="col-span-full text-[color:var(--text-secondary)]">No movies in your library match the criteria.</p>`;
      lucide.createIcons();
      return;
    }

    const params = {
      language: "en-US",
      page: 1,
      sort_by: sortBy,
      "vote_count.gte": sortBy === "vote_average.desc" ? 300 : 10,
    };
    if (genre) {
      params.with_genres = genre;
    }

    await populateGrid(
      "discover/movie",
      "movies-grid",
      createMediaCard,
      params,
    );
  }

  async function loadSeriesPage() {
    const grid = document.getElementById("series-grid");
    grid.innerHTML = `<div class="grid-loader"><div class="loader"></div></div>`;

    const inLibraryFilterBtn = document.getElementById(
      "series-in-library-filter",
    );
    const inLibraryOnly = inLibraryFilterBtn.dataset.active === "true";
    const genre = document.getElementById("series-genre-filter").value;
    const sortBy = document.getElementById("series-sort-by").value;

    if (inLibraryOnly) {
      let series = localSeries;
      if (genre) {
        series = series.filter((s) => s.genre_ids.includes(parseInt(genre)));
      }
      const sortedSeries = sortLocalMedia(series, sortBy);
      grid.innerHTML =
        sortedSeries.length > 0
          ? sortedSeries.map(createMediaCard).join("")
          : `<p class="col-span-full text-[color:var(--text-secondary)]">No series in your library match the criteria.</p>`;
      lucide.createIcons();
      return;
    }

    const params = {
      language: "en-US",
      page: 1,
      sort_by: sortBy,
      "vote_count.gte": sortBy === "vote_average.desc" ? 150 : 10,
    };
    if (genre) {
      params.with_genres = genre;
    }

    await populateGrid("discover/tv", "series-grid", createMediaCard, params);
  }

  async function fetchAndPopulateGenres() {
    try {
      const [movieGenresData, tvGenresData] = await Promise.all([
        fetchFromTMDB("genre/movie/list"),
        fetchFromTMDB("genre/tv/list"),
      ]);
      movieGenres = movieGenresData.genres;
      tvGenres = tvGenresData.genres;

      const movieGenreSelect = document.getElementById("movies-genre-filter");
      const seriesGenreSelect = document.getElementById("series-genre-filter");

      movieGenres.forEach((genre) => {
        movieGenreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
      });
      tvGenres.forEach((genre) => {
        seriesGenreSelect.innerHTML += `<option value="${genre.id}">${genre.name}</option>`;
      });
    } catch (error) {
      console.error("Failed to fetch genres:", error);
    }
  }

  function setupFilterListeners() {
    const movieControls = document.getElementById("movies-controls");
    const seriesControls = document.getElementById("series-controls");
    const moviesInLibraryBtn = document.getElementById(
      "movies-in-library-filter",
    );
    const seriesInLibraryBtn = document.getElementById(
      "series-in-library-filter",
    );
    const localLibrarySortBy = document.getElementById("local-library-sort-by");

    movieControls.addEventListener("change", (e) => {
      if (e.target.matches("select")) {
        loadMoviesPage();
      }
    });
    moviesInLibraryBtn.addEventListener("click", () => {
      const isActive = moviesInLibraryBtn.dataset.active === "true";
      moviesInLibraryBtn.dataset.active = !isActive;
      loadMoviesPage();
    });

    seriesControls.addEventListener("change", (e) => {
      if (e.target.matches("select")) {
        loadSeriesPage();
      }
    });
    seriesInLibraryBtn.addEventListener("click", () => {
      const isActive = seriesInLibraryBtn.dataset.active === "true";
      seriesInLibraryBtn.dataset.active = !isActive;
      loadSeriesPage();
    });
    localLibrarySortBy.addEventListener("change", renderLocalMedia);
  }

  // --- VIDEO PLAYER HANDLING (REVISED for vserve) ---
  const videoPlayerModal = document.getElementById("video-player-modal");
  const videoPlayerContent = document.getElementById("video-player-content");
  const videoCloseBtn = document.getElementById("video-close-btn");
  const videoErrorOverlay = document.getElementById("video-error-overlay");

  function showVideoPlayer(filePath) {
    videoErrorOverlay.classList.add("hidden");
    videoErrorOverlay.classList.remove("flex");

    if (nexusPlayer && nexusPlayer.player) {
      nexusPlayer.player.dispose();
      nexusPlayer = null;
    }

    const existingPlayerEl = document.getElementById("video-player");
    if (existingPlayerEl) {
      existingPlayerEl.remove();
    }

    const videoEl = document.createElement("video");
    videoEl.id = "video-player";
    videoEl.className = "video-js vjs-big-play-centered";
    videoEl.style.width = "100%";
    videoEl.style.height = "100%";

    videoPlayerContent.insertBefore(videoEl, videoErrorOverlay);

    videoPlayerModal.classList.add("visible");

    try {
      console.log("filePath:", filePath);
      nexusPlayer = new VideoPlayer("video-player", filePath);
    } catch (error) {
      console.error("Failed to initialize VideoPlayer:", error);
      videoErrorOverlay.classList.remove("hidden");
      videoErrorOverlay.classList.add("flex");
      lucide.createIcons();
    }
  }

  function hideVideoPlayer() {
    videoPlayerModal.classList.remove("visible");
    if (nexusPlayer && nexusPlayer.player) {
      nexusPlayer.player.dispose();
      nexusPlayer = null;
    }
  }

  videoCloseBtn.addEventListener("click", hideVideoPlayer);
  videoPlayerModal.addEventListener("click", (e) => {
    if (e.target === videoPlayerModal) {
      hideVideoPlayer();
    }
  });

  // --- EVENT DELEGATION FOR DYNAMIC CONTENT ---
  document.body.addEventListener("click", async (e) => {
    // Details button on media cards
    const detailsBtn = e.target.closest(".details-btn");
    if (detailsBtn) {
      const card = detailsBtn.closest("[data-id]");
      if (card) {
        showDetails(card.dataset.id, card.dataset.type);
      }
      return;
    }

    // AI Synopsis button in modal
    const aiBtn = e.target.closest("#ai-synopsis-btn");
    if (aiBtn && !aiBtn.disabled) {
      aiBtn.disabled = true;
      const title = aiBtn
        .closest(".modal-content")
        .querySelector("h2").textContent;
      const area = document.getElementById("ai-synopsis-area");
      area.innerHTML = `<div class="flex justify-center items-center h-20"><div class="loader"></div></div>`;
      const prompt = `Provide a compelling, one-paragraph synopsis for the following title: "${title}".`;
      try {
        const synopsis = await callGeminiAPI(prompt);
        area.innerHTML = `<h3 class="font-semibold text-lg mb-2 text-[color:var(--accent-primary)]">AI Synopsis</h3><p class="text-[color:var(--text-secondary)] leading-relaxed">${synopsis}</p>`;
      } catch (error) {
        area.innerHTML = `<div class="text-red-400">Failed to get AI synopsis. ${error.message}</div>`;
      } finally {
        aiBtn.style.display = "none";
      }
      return;
    }

    // Change TMDB Match button
    const changeTmdbBtn = e.target.closest("#change-tmdb-btn");
    if (changeTmdbBtn) {
      const itemId = changeTmdbBtn.dataset.id;
      const itemType = changeTmdbBtn.dataset.type;
      const itemTitle = changeTmdbBtn.dataset.title;

      const detailsView = document.getElementById("details-view");
      const changeInterfaceDiv = document.getElementById(
        "tmdb-change-interface",
      );

      detailsView.classList.add("hidden");
      changeInterfaceDiv.classList.remove("hidden");

      changeInterfaceDiv.innerHTML = `
                  <h3 class="text-xl font-bold">Change TMDB Match for "${itemTitle}"</h3>
                  <p class="text-sm text-[color:var(--text-secondary)]">Search for the correct title below. The current entry will be replaced.</p>
                  <div class="relative flex gap-2">
                      <input type="text" id="tmdb-change-search-input" placeholder="Search for new title..." class="search-input w-full pl-4 pr-4 py-2 rounded-lg text-base">
                      <button id="tmdb-change-search-btn" data-old-id="${itemId}" data-type="${itemType}" class="px-4 py-2 rounded-lg bg-[color:var(--accent-primary)] text-white font-semibold">Search</button>
                  </div>
                  <div id="tmdb-change-results" class="mt-4 max-h-96 overflow-y-auto space-y-2 p-1">
                      </div>
                  <button id="cancel-tmdb-change-btn" class="mt-4 w-full px-4 py-2 rounded-lg bg-[color:var(--bg-tertiary)] hover:bg-[color:var(--border-color)] text-white font-semibold">Cancel</button>
              `;
      document.getElementById("tmdb-change-search-input").focus();
      return;
    }

    // Search button within the change TMDB interface
    const tmdbChangeSearchBtn = e.target.closest("#tmdb-change-search-btn");
    if (tmdbChangeSearchBtn) {
      const query = document
        .getElementById("tmdb-change-search-input")
        .value.trim();
      if (query) {
        performTmdbChangeSearch(
          query,
          tmdbChangeSearchBtn.dataset.type,
          tmdbChangeSearchBtn.dataset.oldId,
        );
      }
      return;
    }

    // Cancel button within the change TMDB interface
    const cancelChangeBtn = e.target.closest("#cancel-tmdb-change-btn");
    if (cancelChangeBtn) {
      const detailsView = document.getElementById("details-view");
      const changeInterfaceDiv = document.getElementById(
        "tmdb-change-interface",
      );
      changeInterfaceDiv.classList.add("hidden");
      detailsView.classList.remove("hidden");
      changeInterfaceDiv.innerHTML = ""; // Clean up
      return;
    }

    // Select button for a new TMDB entry
    const selectNewTmdbBtn = e.target.closest(".select-new-tmdb-btn");
    if (selectNewTmdbBtn) {
      selectNewTmdbBtn.disabled = true;
      selectNewTmdbBtn.innerHTML = '<div class="loader-small mx-auto"></div>';

      const newId = selectNewTmdbBtn.dataset.newId;
      const oldId = selectNewTmdbBtn.dataset.oldId;
      const type = selectNewTmdbBtn.dataset.type;

      try {
        const newItemData = await fetchFromTMDB(`${type}/${newId}`);
        const localArray = type === "movie" ? localMovies : localSeries;
        const oldItemIndex = localArray.findIndex((item) => item.id == oldId);

        if (oldItemIndex === -1) {
          throw new Error(
            "Could not find the old item in the local library to replace.",
          );
        }

        const oldDbKey = `${type}-${oldId}`;
        const newDbKey = `${type}-${newId}`;
        if (localFileDatabase[oldDbKey]) {
          localFileDatabase[newDbKey] = localFileDatabase[oldDbKey];
          delete localFileDatabase[oldDbKey];
        }

        localArray.splice(oldItemIndex, 1, newItemData);

        const storageData = {
          movies: localMovies,
          series: localSeries,
          fileDatabase: localFileDatabase,
        };
        await fetch("/api/add-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(storageData),
        });

        await showDetails(newId, type);
        renderLocalMedia();
        loadAllContent();
      } catch (error) {
        console.error("Failed to change TMDB entry:", error);
        alert(`Error: ${error.message}`);
        await showDetails(oldId, type); // Revert to old view on failure
      }
      return;
    }

    // Accordion toggle
    const accordionBtn = e.target.closest(".season-accordion-btn");
    if (accordionBtn) {
      const episodeList = accordionBtn.nextElementSibling;
      const icon = accordionBtn.querySelector("i");
      if (episodeList.style.maxHeight) {
        episodeList.style.maxHeight = null;
        icon.style.transform = "rotate(0deg)";
      } else {
        episodeList.style.maxHeight = episodeList.scrollHeight + "px";
      }
    }

    // Play button
    const playBtn = e.target.closest(".play-episode-btn, .play-movie-btn");
    if (playBtn && playBtn.dataset.path) {
      showVideoPlayer(playBtn.dataset.path);
    }
  });

  // --- NAVIGATION HANDLING ---
  const navLinks = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page-content");
  const sidebar = document.getElementById("sidebar");

  function navigateTo(hash) {
    const targetHash = hash || "#dashboard";
    navLinks.forEach((link) =>
      link.classList.toggle("active", link.hash === targetHash),
    );
    pages.forEach((page) =>
      page.classList.toggle("hidden", `#${page.id}` !== targetHash),
    );

    if (searchInput.value.trim().length < 3) {
      pageContentWrapper.classList.remove("hidden");
      searchResultsContainer.classList.add("hidden");
    }

    if (targetHash === "#local-library") {
      renderLocalMedia();
    }

    if (window.innerWidth < 768) {
      sidebar.classList.add("-translate-x-full");
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(e.currentTarget.hash);
    });
  });

  // --- THEME SWITCHING ---
  const themeSwitcher = document.getElementById("theme-switcher");
  const themeButtons = themeSwitcher.querySelectorAll(".theme-switch-btn");
  const appContainer = document.getElementById("app-container");
  const glassBg = document.getElementById("glass-bg-element");
  const themes = ["theme-base", "theme-material", "theme-glass"];

  themeSwitcher.addEventListener("click", (e) => {
    if (e.target.matches("[data-theme]")) {
      const selectedTheme = e.target.dataset.theme;
      themes.forEach((theme) => appContainer.classList.remove(theme));
      appContainer.classList.add(selectedTheme);
      themeButtons.forEach((btn) => btn.classList.remove("active"));
      e.target.classList.add("active");
      glassBg.classList.toggle("hidden", selectedTheme !== "theme-glass");
      if (selectedTheme === "theme-glass") {
        const randomImageUrl = `https://source.unsplash.com/random/1920x1080/?abstract,gradient,${Date.now()}`;
        glassBg.style.backgroundImage = `url('${randomImageUrl}')`;
      }
    }
  });

  // --- MOBILE MENU ---
  const menuToggle = document.getElementById("menu-toggle");
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("-translate-x-full");
  });

  // --- REFETCH LOCAL DATA ON START IF PRESENT ---
  async function refetchAtStartup() {
    try {
      const response = await fetch(`/api/get-media`);
      if (!response.ok) {
        console.warn(
          "Could not fetch local media data. Starting with a fresh library.",
        );
        return;
      }
      const data = await response.json();
      console.log("Fetched local media data:", data);

      // Directly populate the global variables from the persistent storage
      if (data.movies) {
        localMovies = data.movies;
      }
      if (data.series) {
        localSeries = data.series;
      }
      if (data.fileDatabase) {
        localFileDatabase = data.fileDatabase;
      }

      // After loading, refresh the UI.
      renderLocalMedia();

      if (localMovies.length + localSeries.length > 0) {
        localStatus.innerHTML = `
                <div class="p-4 bg-green-900/50 text-green-300 rounded-lg">
                    <p>Library reloaded. Found ${localMovies.length} movies and ${localSeries.length} series.</p>
                </div>`;

        setTimeout(() => {
          localStatus.innerHTML = "";
        }, 6000);
      }
    } catch (error) {
      console.error("Error during startup data fetch:", error);
      // Don't block the app if the fetch fails. It just means no local media is loaded.
    }
  }

  // --- INITIALIZATION ---
  async function initialize() {
    await refetchAtStartup();
    lucide.createIcons();
    themeButtons[0].classList.add("active");
    fetchAndPopulateGenres();
    loadAllContent();
    setupFilterListeners();
    navigateTo(window.location.hash || "#dashboard");
  }

  await initialize();
});

