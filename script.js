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
		return this.tracks.filter((track) => track.kind === 'Audio');
	}

	getSubtitleTracks() {
		// track.kind is an object in the form { "Subtitle" : true }
		// I dont care about the value
		return this.tracks.filter((track) => (typeof track.kind === 'object') && ("Subtitle" in track.kind));
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
			throw new Error(`Cannot read BigUint64, insufficient data at offset ${this.offset}`);
		}
		const value = this.dataView.getBigUint64(this.offset, true);
		this.offset += 8;
		return value;
	}

	// Helper method to read a chunk of data safely
	readBytes(length) {
		if (this.offset + length > this.dataView.byteLength) {
			throw new Error(
				`Cannot read ${length} bytes, only ${this.dataView.byteLength - this.offset} remaining`
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
				throw new Error(`Invalid number of audio tracks: ${this.numAudioTracks}`);
			}
			this.numSubTracks = this.readUint32();
			// Read and validate the video track length
			const videoTrackLength = Number(this.readBigUint64());
			if (videoTrackLength <= 0 || videoTrackLength > this.dataView.byteLength) {
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
				subtitleTracks: this.subtitleTracks
			};
		} catch (error) {
			console.error('Error parsing video data:', error.message);
			throw error;
		}
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

		if ('MediaSource' in window) {
			this.initializeMediaSource();
			this.addEventListeners();
		} else {
			console.error('MediaSource API is not supported in this browser.');
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
			this.videoElement.dispatchEvent(new Event('timeupdate'));
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
					default: 0
				},
				// Switch between audio tracks
				audioTracks: {
					default: 0
				},
				remainingTimeDisplay: {
					displayNegative: false
				}
			},
			spatialNavigation: {
				enabled: true,
				horizontalSeek: true
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
								this.player.textTracks().forEach((track) => track.enabled(!track.enabled()));
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

		this.player.ready(function() {
			var settings = this.textTrackSettings;
			settings.setValues({
				"backgroundColor": "#000",
				"backgroundOpacity": "0",
				"edgeStyle": "uniform",
			});
			settings.updateDisplay();
		});

		let audioTracks = this.videoMetadata.getAudioTracks();
		for (let i = 0; i < audioTracks.length; i++) {
			const audioTrack = audioTracks[i];
			var vidjsTrack = new videojs.AudioTrack({
				id: audioTrack.id,
				kind: 'Audio',
				label: audioTrack.label,
				language: audioTrack.language
			});
			this.player.audioTracks().addTrack(vidjsTrack);
		}
		var audioTrackList = this.player.audioTracks();
		var self = this;
		audioTrackList.addEventListener('change', async function() {
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
		});
	}

	async switchSubtitleTrackByIndex(direction) {
		// TODO: Implement subtitle track switching
	}

	async switchAudioTrackByIndex(direction) {
		const audioTracks = this.videoMetadata.getAudioTracks();
		const currentIndex = audioTracks.findIndex((track) => track.id === this.audioIdx);
		const newIndex = (currentIndex + direction + audioTracks.length) % audioTracks.length;
		const newAudioTrackId = audioTracks[newIndex].id;
		this.audioIdx = newAudioTrackId;
		await this.switchAudioTrack();
	}

	async switchAudioTrack() {
		// Abort any ongoing source buffer operations
		if (this.audioSourceBuffer.updating) {
			await new Promise((resolve) =>
				this.audioSourceBuffer.addEventListener('updateend', resolve, { once: true })
			);
		}

		// Check if there is any buffered range to remove
		const audioBufferedRanges = this.audioSourceBuffer.buffered;
		if (audioBufferedRanges.length > 0) {
			const audioBufferStart = audioBufferedRanges.start(0);
			const audioBufferEnd = audioBufferedRanges.end(audioBufferedRanges.length - 1);

			this.audioSourceBuffer.remove(audioBufferStart, audioBufferEnd);

			// Wait for buffer removal to complete
			await new Promise((resolve) =>
				this.audioSourceBuffer.addEventListener('updateend', resolve, { once: true })
			);
		}

		// Clear the video buffer
		const videoBufferedRanges = this.videoSourceBuffer.buffered;
		if (videoBufferedRanges.length > 0) {
			const videoBufferStart = videoBufferedRanges.start(0);
			const videoBufferEnd = videoBufferedRanges.end(videoBufferedRanges.length - 1);

			this.videoSourceBuffer.remove(videoBufferStart, videoBufferEnd);

			// Wait for buffer removal to complete
			await new Promise((resolve) =>
				this.videoSourceBuffer.addEventListener('updateend', resolve, { once: true })
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
		this.mediaSource.addEventListener('sourceopen', async () => {
			await this.loadInitialMetadata();
			this.initVideoJs();
			await this.fetchSubtitles();
			await this.initializeSourceBuffer();
			await this.fetchVideoChunk(0.0);
		});
	}

	addEventListeners() {
		this.videoElement.addEventListener('seeking', async () => {
			let bufferedAreas = { currentTime: this.videoElement.currentTime, buffered: [] };
			let videoBufferedRanges = this.videoSourceBuffer.buffered;
			for (let i = 0; i < videoBufferedRanges.length; i++) {
				const start = videoBufferedRanges.start(i);
				const end = videoBufferedRanges.end(i);
				bufferedAreas.buffered.push({ start: start, end: end });
			}
			this.isSeeking = true;
			if (this.videoSourceBuffer && !this.videoSourceBuffer.updating && !this.isFetching) {
				const currentTime = this.videoElement.currentTime;
				this.fetchVideoChunk(currentTime);
			}
		});

		this.videoElement.addEventListener('seeked', () => {
			this.isSeeking = false;
		});

		this.videoElement.addEventListener('timeupdate', async () => {
			if (!this.videoSourceBuffer || this.videoSourceBuffer.updating || this.isFetching) {
				return;
			}

			const currentTime = this.videoElement.currentTime;
			const bufferEnd = this.getRelevantBufferEnd();

			if ((currentTime >= bufferEnd - 3) || this.isSeeking) {
				const newTime = await this.bufferNextVideoChunk(currentTime);
				if (this.isSeeking) {
					this.isSeeking = false;
					this.videoElement.currentTime = newTime + 0.3;
				}
			}
		});
	}

	async initializeSourceBuffer() {
		this.videoSourceBuffer = this.mediaSource.addSourceBuffer(this.videoMimeType);
		this.videoSourceBuffer.mode = 'segments';
		this.videoSourceBuffer.addEventListener('error', (e) => {
			console.error('SourceBuffer error:', e);
		});

		const audioSourceBuffer = this.mediaSource.addSourceBuffer(this.audioMimeType);
		audioSourceBuffer.mode = 'segments';
		audioSourceBuffer.addEventListener('error', (e) => {
			console.error('Audio SourceBuffer error:', e);
		})
		this.audioSourceBuffer = audioSourceBuffer;
	}

	async loadInitialMetadata() {
		const response = await fetch(`/video-data?path=${this.videoPath}`);
		if (!response.ok) throw new Error('Failed to fetch video duration');

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
				kind: 'subtitles',
				label: subtitleTrack.label,
				srclang: 'en',
				//src: url,
			});

			// Store track reference for later updates
			this.subtitleTrackElements.push({ idx: i, element: track });
		}
	}

	async fetchVideoChunk(startTime) {
		if (this.isFetching || !this.videoSourceBuffer || this.videoSourceBuffer.updating) return;

		this.isFetching = true;

		try {
			// Abort any ongoing updates
			if (this.videoSourceBuffer.updating || this.audioSourceBuffer.updating) {
				this.videoSourceBuffer.abort();
				this.audioSourceBuffer.abort();
			}

			this.videoSourceBuffer.timestampOffset = startTime;
			this.audioSourceBuffer.timestampOffset = startTime;
			const response = await fetch(`/video?path=${this.videoPath}&timestamp=${startTime}&duration=10`);
			if (!response.ok) {
				throw new Error('Failed to fetch video chunk');
			}

			const arrayBuffer = await response.arrayBuffer();

			// Parse the binary data using the VideoResponseParser class
			const parser = new VideoResponseParser(arrayBuffer);
			const parsedData = parser.parse();

			// Append the video data to the video source buffer
			if (this.videoSourceBuffer && !this.videoSourceBuffer.updating) {
				this.videoSourceBuffer.appendBuffer(parsedData.videoData);
				await new Promise((resolve) =>
					this.videoSourceBuffer.addEventListener('updateend', resolve, { once: true })
				);
			}

			// Append audio data to the audio source buffer
			if (this.audioSourceBuffer && !this.audioSourceBuffer.updating) {
				this.audioSourceBuffer.appendBuffer(parsedData.audioTracks[this.audioIdx].data);
				await new Promise((resolve) =>
					this.audioSourceBuffer.addEventListener('updateend', resolve, { once: true })
				);
			}

			// Append subtitle data to track elements
			for (let i = 0; i < parsedData.numSubTracks; i++) {
				const subtitleTrackData = parsedData.subtitleTracks[i];
				const trackElement = this.subtitleTrackElements.find((track) => track.idx === Number(subtitleTrackData.id));
				let subtitleText = new TextDecoder('utf-8').decode(subtitleTrackData.data);
				let vjsTexttracks = this.player.textTracks();
				for (let j = 0; j < vjsTexttracks.length; j++) {
					if (vjsTexttracks[j].label === trackElement.element.label) {
						let vjsTexttrack = vjsTexttracks[j];
						// Remove all existing cues
						while (vjsTexttrack.cues.length > 0) {
							vjsTexttrack.removeCue(vjsTexttrack.cues[0]);
						}
						const parser = new WebVTTParser();
						const subtitleCues = parser.parse(subtitleText, 'subtitles');
						for (let k = 0; k < subtitleCues.cues.length; k++) {
							vjsTexttrack.addCue(subtitleCues.cues[k]);
						}
					}
				}
				//URL.revokeObjectURL(trackElement.element.src);
				//trackElement.element.src(URL.createObjectURL(new Blob([subtitleText], { type: 'text/vtt' })));
			}
		} catch (error) {
			console.error('Error fetching video chunk:', error.message);
		} finally {
			this.isFetching = false;
		}
	}

	async bufferNextVideoChunk(currentTime) {
		try {
			if (!this.videoSourceBuffer || !this.audioSourceBuffer) {
				console.error('Source buffers not initialized');
				return;
			}

			const newTime = Math.ceil(currentTime / 10) * 10;

			await this.fetchVideoChunk(newTime);
			return newTime;
		} catch (error) {
			console.error('Error during reload:', error.message);
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

document.addEventListener('DOMContentLoaded', async () => {
	const videoPlayer = new VideoPlayer(
		'videoPlayer',
		//'/run/media/spandan/Spandy HDD/Series/Fullmetal Alchemist Brotherhood/Series/Fullmetal Alchemist Brotherhood - S01E19.mkv',
		// '/run/media/spandan/Spandy HDD/Series/That Time I Got Reincarnated as a Slime/Season 1/S01E03-Battle at the Goblin Village [8DB036B0].mkv'
		'/home/spandan/Videos/p5hk.mp4'
	);
	if (videoPlayer) {
		console.log('Video player initialized');
	}
});
