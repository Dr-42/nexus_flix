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
	constructor(duration, tracks) {
		this.duration = duration;
		this.tracks = tracks;
	}

	static fromJson(json) {
		const tracks = Track.fromJsonArray(json.tracks);
		return new VideoMetadata(json.duration, tracks);
	}

	getAudioTracks() {
		return this.tracks.filter((track) => track.kind === 'Audio');
	}

	getSubtitleTracks() {
		return this.tracks.filter((track) => track.kind === 'Subtitle');
	}
}

class VideoResponseParser {
	constructor(arrayBuffer) {
		this.arrayBuffer = arrayBuffer;
		this.dataView = new DataView(arrayBuffer);
		this.offset = 0;

		// Parsed fields
		this.numAudioTracks = 0;
		this.videoData = null;
		this.audioTracks = [];
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
			console.log(`Number of audio tracks: ${this.numAudioTracks}`);
			// Read and validate the video track length
			const videoTrackLength = Number(this.readBigUint64());
			if (videoTrackLength <= 0 || videoTrackLength > this.dataView.byteLength) {
				throw new Error(`Invalid video track length: ${videoTrackLength}`);
			}
			console.log(`Video track length: ${videoTrackLength}`);
			this.videoData = this.readBytes(videoTrackLength);

			// Read and store audio tracks
			for (let i = 0; i < this.numAudioTracks; i++) {
				const trackId = this.readBigUint64();
				const trackLength = Number(this.readBigUint64());

				if (trackLength <= 0 || trackLength > this.dataView.byteLength) {
					throw new Error(`Invalid audio track length: ${trackLength}`);
				}
				const trackData = this.readBytes(trackLength);

				console.log(`Audio track ID: ${trackId}, length: ${trackLength}`);
				this.audioTracks.push({ id: trackId, data: trackData });
			}

			// Return parsed data
			return {
				numAudioTracks: this.numAudioTracks,
				videoData: this.videoData,
				audioTracks: this.audioTracks,
			};
		} catch (error) {
			console.error('Error parsing video data:', error.message);
			throw error;
		}
	}
}

class SubtitleData {
	constructor(id, data) {
		this.id = id;
		this.data = data;
	}

	static fromJson(json) {
		return new SubtitleData(json.id, json.data);
	}

	static fromJsonArray(jsonArray) {
		return jsonArray.map((json) => SubtitleData.fromJson(json));
	}
}

class SubtitleResponseParser {
	constructor(numSubtitles, subtitles) {
		this.numSubtitles = numSubtitles;
		this.subtitles = subtitles;
	}

	static fromJson(json) {
		return new SubtitleResponseParser(json.num_subs, SubtitleData.fromJsonArray(json.subs));
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

		if ('MediaSource' in window) {
			this.initializeMediaSource();
			this.addEventListeners();
		} else {
			console.error('MediaSource API is not supported in this browser.');
		}
	}

	initVideoJs() {
		this.player = videojs(this.videoElementId, {
			controls: true,
			autoplay: true,
			enableSmoothSeeking: true,
			fluid: true,
			nativeControlsForTouch: true,
			playbackRates: [0.5, 1, 1.5, 2],
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
				hotkeys: function(event) {
					// `this` is the player in this context

					// `x` key = pause
					if (event.which === 88) {
						this.pause();
					}
					// `y` key = play
					if (event.which === 89) {
						this.play();
					}
					// `j` key = seek backward
					if (event.which === 74) {
						this.currentTime(this.currentTime() - 10);
					}
					// `l` key = seek forward
					if (event.which === 76) {
						this.currentTime(this.currentTime() + 10);
					}
				}
			}
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

					console.log(`Switched to audio track: ${vidjsAudioTrack.id} Idx: ${self.audioIdx}`);
					return;
				}
			}
		});
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

			console.log(`Clearing audio buffer from ${audioBufferStart} to ${audioBufferEnd}`);
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

			console.log(`Clearing video buffer from ${videoBufferStart} to ${videoBufferEnd}`);
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

		console.log(`Fetching audio data for new track at time ${flooredTime}`);
		// Fetch new audio data for the selected track
		await this.fetchVideoChunk(flooredTime);
		this.videoElement.currentTime = flooredTime + 0.3;
	}


	async initializeMediaSource() {
		this.mediaSource = new MediaSource();
		this.videoElement.src = URL.createObjectURL(this.mediaSource);
		this.mediaSource.addEventListener('sourceopen', async () => {
			await this.loadInitialMetadata();
			await this.fetchSubtitles();
			this.initVideoJs();
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
			console.log('Seeking', bufferedAreas);
			this.isSeeking = true;
			if (this.videoSourceBuffer && !this.videoSourceBuffer.updating && !this.isFetching) {
				const currentTime = this.videoElement.currentTime;
				this.fetchVideoChunk(currentTime);
				console.log(`Fetching chunk for seeking at time: ${currentTime}`);
			}
		});

		this.videoElement.addEventListener('seeked', () => {
			console.log('Seeked');
			this.isSeeking = false;
		});

		this.videoElement.addEventListener('timeupdate', async () => {
			if (!this.videoSourceBuffer || this.videoSourceBuffer.updating || this.isFetching) {
				console.log('Skipping time update');
				return;
			}

			const currentTime = this.videoElement.currentTime;
			const bufferEnd = this.getRelevantBufferEnd();

			if (currentTime >= bufferEnd - 3) {
				const newTime = await this.bufferNextVideoChunk(currentTime);
				if (this.isSeeking) {
					console.log(`Seeking to time: ${newTime}`);
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

		console.log(`Video metadata: ${JSON.stringify(videoMetadata)}`);
	}

	async fetchSubtitles() {
		const response = await fetch(`/video-subs?path=${this.videoPath}`);
		if (!response.ok) throw new Error('Failed to fetch subtitles');

		const responseJson = await response.json();
		const subtitleData = SubtitleResponseParser.fromJson(responseJson);

		// Add track fields and subtitle data
		const subtitleTracks = this.videoMetadata.getSubtitleTracks();
		for (let i = 0; i < subtitleData.numSubtitles; i++) {
			const subtitleTrack = subtitleTracks[i];
			let trackElement = document.createElement('track');
			trackElement.kind = 'subtitles';
			trackElement.label = subtitleTrack.label;
			trackElement.srclang = subtitleTrack.language;
			trackElement.src = URL.createObjectURL(new Blob([subtitleData.subtitles[i].data], { type: 'text/vtt' }));
			if (i == 0) trackElement.default = true;
			trackElement.mode = 'showing';
			this.videoElement.appendChild(trackElement);
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

			console.log(`Reloading video and audio chunks at time: ${newTime}`);
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
		'/run/media/spandan/Spandy HDD/Series/Fullmetal Alchemist Brotherhood/Series/Fullmetal Alchemist Brotherhood - S01E13.mkv',
	);
	if (videoPlayer) {
		console.log('Video player initialized');
	}
});
