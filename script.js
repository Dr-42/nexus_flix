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
}

class VideoPlayer {
	constructor(videoElementId, videoPath, mimeType) {
		this.videoElement = document.getElementById(videoElementId);
		this.videoPath = encodeURI(videoPath);
		this.mimeType = mimeType;
		this.mediaSource = null;
		this.sourceBuffer = null;
		this.isFetching = false;
		this.isSeeking = false;
		this.videoMetadata = null;

		if ('MediaSource' in window) {
			this.initializeMediaSource();
			this.addEventListeners();
		} else {
			console.error('MediaSource API is not supported in this browser.');
		}
	}

	initializeMediaSource() {
		this.mediaSource = new MediaSource();
		this.videoElement.src = URL.createObjectURL(this.mediaSource);

		this.mediaSource.addEventListener('sourceopen', async () => {
			try {
				await this.initializeSourceBuffer();
				await this.loadInitialMetadata();
				await this.fetchVideoChunk(0.0);
			} catch (error) {
				console.error('Error initializing MediaSource:', error.message);
			}
		});
	}

	addEventListeners() {
		this.videoElement.addEventListener('seeking', async () => {
			this.isSeeking = true;
			if (this.sourceBuffer && !this.sourceBuffer.updating && !this.isFetching) {
				const currentTime = this.videoElement.currentTime;
				const newTime = await this.reloadVideoChunk(currentTime, false);
				console.log(`Fetching chunk proactively for seeking at time: ${newTime}`);
			}
		});

		this.videoElement.addEventListener('seeked', () => {
			this.isSeeking = false;
		});

		this.videoElement.addEventListener('timeupdate', async () => {
			if (!this.sourceBuffer || this.sourceBuffer.updating || this.isFetching) return;

			const currentTime = this.videoElement.currentTime;
			const bufferEnd = this.getRelevantBufferEnd();

			if (currentTime >= bufferEnd - 2) {
				const newTime = await this.reloadVideoChunk(currentTime, true);
				if (this.isSeeking) {
					console.log(`Seeking to time: ${newTime}`);
					this.isSeeking = false;
					this.videoElement.currentTime = newTime;
				}
			}
		});
	}

	async initializeSourceBuffer() {
		this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
		this.sourceBuffer.mode = 'segments';

		this.sourceBuffer.addEventListener('error', (e) => {
			console.error('SourceBuffer error:', e);
		});
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

	async fetchVideoChunk(startTime) {
		if (this.isFetching || !this.sourceBuffer || this.sourceBuffer.updating) return;

		this.isFetching = true;

		try {
			const response = await fetch(`/video?path=${this.videoPath}&timestamp=${startTime}`);
			if (!response.ok) {
				throw new Error('Failed to fetch video chunk');
			}

			const arrayBuffer = await response.arrayBuffer();

			// Parse the binary data using the VideoResponseParser class
			const parser = new VideoResponseParser(arrayBuffer);
			const parsedData = parser.parse();

			// Append the video data to the source buffer
			if (this.sourceBuffer && !this.sourceBuffer.updating) {
				this.sourceBuffer.appendBuffer(parsedData.videoData);
			}

			console.log('Parsed data:', parsedData);
		} catch (error) {
			console.error('Error fetching video chunk:', error);
		} finally {
			this.isFetching = false;
		}
	}

	async reloadVideoChunk(currentTime, ceil) {
		try {
			this.sourceBuffer.abort();

			const newTime = ceil ? Math.ceil(currentTime / 10) * 10 : currentTime;
			this.sourceBuffer.timestampOffset = newTime;

			await this.fetchVideoChunk(newTime);
			return newTime;
		} catch (error) {
			console.error('Error during reload:', error.message);
		}
	}

	getRelevantBufferEnd() {
		let bufferEnd = 0;

		for (let i = 0; i < this.sourceBuffer.buffered.length; i++) {
			const start = this.sourceBuffer.buffered.start(i);
			const end = this.sourceBuffer.buffered.end(i);

			if (start <= this.videoElement.currentTime && end > bufferEnd) {
				bufferEnd = end;
			}
		}

		return bufferEnd;
	}
}

class VideoResponseParser {
	constructor(arrayBuffer) {
		this.arrayBuffer = arrayBuffer;
		this.dataView = new DataView(arrayBuffer);
		this.offset = 0;

		// Parsed fields
		this.numAudioTracks = 0;
		this.numSubtitleTracks = 0;
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
			console.log(`Number of audio tracks: ${this.numAudioTracks}`);

			// Read and validate the number of subtitle tracks
			this.numSubtitleTracks = this.readUint32();
			if (this.numSubtitleTracks < 0 || this.numSubtitleTracks > 100) {
				throw new Error(`Invalid number of subtitle tracks: ${this.numSubtitleTracks}`);
			}
			console.log(`Number of subtitle tracks: ${this.numSubtitleTracks}`);

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

			// Read and store subtitle tracks
			for (let i = 0; i < this.numSubtitleTracks; i++) {
				const trackId = this.readBigUint64();
				const trackLength = Number(this.readBigUint64());

				if (trackLength <= 0 || trackLength > this.dataView.byteLength) {
					throw new Error(`Invalid subtitle track length: ${trackLength}`);
				}
				const trackData = this.readBytes(trackLength);

				console.log(`Subtitle track ID: ${trackId}, length: ${trackLength}`);
				this.subtitleTracks.push({ id: trackId, data: trackData });
			}

			// Return parsed data
			return {
				numAudioTracks: this.numAudioTracks,
				numSubtitleTracks: this.numSubtitleTracks,
				videoData: this.videoData,
				audioTracks: this.audioTracks,
				subtitleTracks: this.subtitleTracks,
			};
		} catch (error) {
			console.error('Error parsing video data:', error.message);
			throw error;
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const videoPlayer = new VideoPlayer(
		'videoPlayer',
		'/run/media/spandan/Spandy HDD/Series/Fullmetal Alchemist Brotherhood/Series/Fullmetal Alchemist Brotherhood - S01E13.mkv',
		'video/mp4; codecs="avc1.640029"'
	);
	videoPlayer.initializeMediaSource();
	videoPlayer.addEventListeners();
	videoPlayer.loadInitialMetadata();
	videoPlayer.fetchVideoChunk(0.0);
});
