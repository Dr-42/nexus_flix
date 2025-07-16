# `video-player.js`

**Custom Video Player**

This module implements a custom video player using the MediaSource API and Video.js. It handles video streaming, audio and subtitle track switching, and custom controls.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#VideoPlayer|VideoPlayer]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#debounceSeek|debounceSeek]]
  - [[#initVideoJs|initVideoJs]]
  - [[#handleHotkeys|handleHotkeys]]
  - [[#setupSettingsModal|setupSettingsModal]]
  - [[#setupAudioTracks|setupAudioTracks]]
  - [[#switchSubtitleTrackByIndex|switchSubtitleTrackByIndex]]
  - [[#switchAudioTrackByIndex|switchAudioTrackByIndex]]
  - [[#switchAudioTrack|switchAudioTrack]]
  - [[#initializeMediaSource|initializeMediaSource]]
  - [[#addEventListeners|addEventListeners]]
  - [[#initializeSourceBuffer|initializeSourceBuffer]]
  - [[#loadInitialMetadata|loadInitialMetadata]]
  - [[#fetchSubtitles|fetchSubtitles]]
  - [[#fetchVideoChunk|fetchVideoChunk]]
  - [[#bufferNextVideoChunk|bufferNextVideoChunk]]
  - [[#getRelevantBufferEnd|getRelevantBufferEnd]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `VideoMetadata`: To handle video metadata.
- `VideoResponseParser`: To parse the video data received from the backend.
- `WebVTTParser`: To parse WebVTT subtitle data.
- `SettingsModal`: To create the settings modal for the video player.

---

## Class

### `VideoPlayer`

A class that encapsulates all the logic for the custom video player.

---

## Methods

### `constructor`

Initializes the `VideoPlayer` class and sets up the core components for media playback.

```javascript
constructor(videoElementId, videoPath) {
    this.videoElementId = videoElementId;
    this.videoElement = document.getElementById(videoElementId);
    this.videoPath = encodeURI(videoPath);
    this.videoMimeType = 'video/mp4 ; codecs="avc1.42E01E"'; // MIME type for video stream
    this.audioMimeType = 'audio/mp4 ; codecs="opus"'; // MIME type for audio stream
    this.mediaSource = null; // MediaSource object for dynamic streaming
    this.videoSourceBuffer = null; // SourceBuffer for video data
    this.audioSourceBuffer = null; // SourceBuffer for audio data
    this.isFetching = false; // Flag to prevent concurrent fetches
    this.isSeeking = false; // Flag to indicate a seek operation is in progress
    this.videoMetadata = null; // Stores metadata fetched from the backend
    this.player = null; // Video.js player instance
    this.audioIdx = 0; // Current audio track index
    this.subtitleTrackElements = []; // Array to store references to subtitle tracks
    this.seekDuration = 0; // Accumulator for debounced seek operations
    this.seekDelay = 500; // Delay in milliseconds for debouncing seek
    this.seekTimer = null; // Timer for debouncing seek

    if ("MediaSource" in window) {
      this.initializeMediaSource();
      this.addEventListeners();
    } else {
      console.error("MediaSource API is not supported in this browser.");
    }
}
```

- **Purpose**: Sets up initial state, references to DOM elements, and checks for MediaSource API support before initiating the player setup.

### `debounceSeek`

Debounces seek actions to prevent excessive seeking, ensuring smoother navigation through the video.

```javascript
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
      this.videoElement.dispatchEvent(new Event("timeupdate"));
    }, this.seekDelay);
}
```

- **Purpose**: Accumulates small seek requests over a short period and executes a single seek operation, reducing strain on the buffering system.

### `initVideoJs`

Initializes the Video.js player instance with custom configurations and hotkey support.

```javascript
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
        subtitles: {
          default: 0,
        },
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
        hotkeys: (event) => this.handleHotkeys(event),
      },
    });

    this.player.ready(() => {
      var settings = this.textTrackSettings;
      settings.setValues({
        backgroundColor: "#000",
        backgroundOpacity: "0",
        edgeStyle: "uniform",
      });
      settings.updateDisplay();
    });

    this.setupAudioTracks();
    this.setupSettingsModal();
}
```

- **Purpose**: Configures the Video.js player, enabling controls, autoplay, fluid sizing, and custom hotkey handling. It also sets up initial text track settings and integrates audio track management and the settings modal.

### `handleHotkeys`

Manages keyboard shortcuts for common player actions like play/pause, seeking, volume control, fullscreen, and track switching.

```javascript
handleHotkeys(event) {
    switch (event.key) {
      case " ": // Space: Pause/Resume
      case "ArrowLeft": // Left: Seek backward
      case "ArrowRight": // Right: Seek forward
      case "ArrowUp": // Up: Increase volume
      case "ArrowDown": // Down: Decrease volume
      case "f": // F: Toggle fullscreen
      case "Escape": // Esc: Exit fullscreen
      case "a": // A: Cycle audio tracks
      case "s": // S: Cycle subtitle tracks
      case "t": // T: Open theme settings
        // ... implementation for each key ...
    }
}
```

- **Purpose**: Provides a convenient way for users to control the player using keyboard commands, enhancing usability.

### `setupSettingsModal`

Integrates the `SettingsModal` for video player theme customization and adds a floating button to access it.

```javascript
setupSettingsModal() {
    this.settingsModal = new SettingsModal(this.player);
    const settingsButton = document.createElement('button');
    // ... button styling and event listener ...
    const playerContainer = this.player.el().parentElement || this.player.el();
    if (playerContainer) {
      playerContainer.style.position = 'relative';
      playerContainer.appendChild(settingsButton);
    }
}
```

- **Purpose**: Allows users to change the video player's visual theme dynamically, improving the user experience.

### `setupAudioTracks`

Adds available audio tracks to the Video.js player and sets up a listener for audio track changes.

```javascript
setupAudioTracks() {
    let audioTracks = this.videoMetadata.getAudioTracks();
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
      // ... logic to switch audio track ...
    });
}
```

- **Purpose**: Enables users to select different audio tracks if available in the video stream.

### `switchSubtitleTrackByIndex`

(Currently a TODO in the code) This method is intended to cycle through available subtitle tracks.

### `switchAudioTrackByIndex`

Cycles through the available audio tracks based on a given direction (forward/backward).

```javascript
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
```

- **Purpose**: Provides a programmatic way to change the active audio track.

### `switchAudioTrack`

Handles the complex process of switching audio tracks by clearing and re-appending data to the MediaSource buffers.

```javascript
async switchAudioTrack() {
    // Abort any ongoing source buffer operations
    // Remove existing buffered ranges for audio and video
    // Reset timestamp offsets
    // Fetch new video chunk with the selected audio track
}
```

- **Purpose**: Ensures a seamless transition between audio tracks by managing the MediaSource buffers, which is crucial for dynamic streaming.

### `initializeMediaSource`

Initializes the MediaSource API, creates an object URL for the video element, and sets up the `sourceopen` event listener.

```javascript
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
```

- **Purpose**: This is the entry point for MediaSource-based streaming. Once the `MediaSource` is ready (`sourceopen`), it triggers the loading of metadata, Video.js initialization, subtitle fetching, source buffer setup, and the initial video chunk fetch.

### `addEventListeners`

Attaches event listeners to the video element for `seeking`, `seeked`, and `timeupdate` events to manage buffering and seeking behavior.

```javascript
addEventListeners() {
    this.videoElement.addEventListener("seeking", async () => {
      // ... logic for seeking ...
    });

    this.videoElement.addEventListener("seeked", () => {
      this.isSeeking = false;
    });

    this.videoElement.addEventListener("timeupdate", async () => {
      // ... logic for buffering and fetching next chunks ...
    });
}
```

- **Purpose**: These listeners are fundamental for the player's adaptive streaming capabilities, ensuring that video data is fetched and buffered efficiently as the user plays or seeks through the content.

### `initializeSourceBuffer`

Creates and configures the `SourceBuffer` objects for video and audio data, setting their MIME types and modes.

```javascript
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
```

- **Purpose**: Prepares the MediaSource for receiving and appending video and audio data segments.

### `loadInitialMetadata`

Fetches initial video metadata (duration, tracks) from the backend.

```javascript
async loadInitialMetadata() {
    const response = await fetch(`/video-data?path=${this.videoPath}`);
    if (!response.ok) throw new Error("Failed to fetch video duration");

    const data = await response.json();
    const videoMetadata = VideoMetadata.fromJson(data);

    this.videoMetadata = videoMetadata;
    this.mediaSource.duration = this.videoMetadata.duration;
}
```

- **Purpose**: Retrieves essential information about the video file, such as its total duration and available audio/subtitle tracks, which is necessary for player setup and track management.

### `fetchSubtitles`

Adds available subtitle tracks to the Video.js player.

```javascript
async fetchSubtitles() {
    const subtitleTracks = this.videoMetadata.getSubtitleTracks();
    for (let i = 0; i < subtitleTracks.length; i++) {
      if (this.videoMetadata.unavailableSubs.includes(i)) continue;
      const subtitleTrack = subtitleTracks[i];

      let track = this.player.addRemoteTextTrack({
        kind: "subtitles",
        label: subtitleTrack.label,
        srclang: "en",
      });
      this.subtitleTrackElements.push({ idx: i, element: track });
    }
}
```

- **Purpose**: Makes subtitle options available to the user within the player interface.

### `fetchVideoChunk`

Fetches a segment of video data from the backend, parses the binary response, and appends it to the respective `SourceBuffer`s.

```javascript
async fetchVideoChunk(startTime) {
    if (this.isFetching || !this.videoSourceBuffer || this.videoSourceBuffer.updating) return;

    this.isFetching = true;

    try {
      // Abort ongoing updates if any
      // Set timestamp offsets for source buffers
      // Fetch binary video data from backend
      // Parse binary data using VideoResponseParser
      // Append video data to videoSourceBuffer
      // Append audio data to audioSourceBuffer
      // Append subtitle data to text tracks
    } catch (error) {
      console.error("Error fetching video chunk:", error.message);
    } finally {
      this.isFetching = false;
    }
}
```

- **Purpose**: This is the core streaming logic. It requests a specific segment of the video, processes the binary data (which includes video, audio, and subtitle streams), and feeds it to the browser's media pipeline via `SourceBuffer.appendBuffer()`. This method is called repeatedly to ensure continuous playback.

### `bufferNextVideoChunk`

Determines the next chunk to buffer based on the current playback time and initiates a fetch.

```javascript
async bufferNextVideoChunk(currentTime) {
    try {
      if (!this.videoSourceBuffer || !this.audioSourceBuffer) {
        console.error("Source buffers not initialized");
        return;
      }
      const newTime = Math.ceil(currentTime / 10) * 10; // Calculate next 10-second interval
      await this.fetchVideoChunk(newTime);
      return newTime;
    } catch (error) {
      console.error("Error during reload:", error.message);
    }
}
```

- **Purpose**: Ensures that the player continuously buffers ahead of the current playback position, preventing stalls and providing a smooth viewing experience.

### `getRelevantBufferEnd`

Calculates the end time of the currently buffered video segment that is relevant to the current playback position.

```javascript
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
```

- **Purpose**: Helps the `timeupdate` listener determine when to request the next video chunk, ensuring efficient buffering.

---

## Related Documentation
- [[video-metadata]]
- [[video-response-parser]]
- [[webvtt-parser]]
- [[settings-modal]]
- [[Frontend Overview]]