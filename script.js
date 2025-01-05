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
		this.videoDuration = 0;

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

		this.videoDuration = videoMetadata.duration;
		this.mediaSource.duration = this.videoDuration;

		console.log(`Video duration: ${this.videoDuration}`);
	}

	async fetchVideoChunk(startTime) {
		if (this.isFetching || !this.sourceBuffer || this.sourceBuffer.updating) return;

		this.isFetching = true;
		try {
			console.log(`Fetching video chunk for time: ${startTime}`);

			const response = await fetch(`/video?path=${this.videoPath}&timestamp=${startTime}`);
			if (!response.ok) throw new Error('Failed to fetch video chunk');

			const data = await response.arrayBuffer();
			this.sourceBuffer.appendBuffer(data);

			console.log(`Fetched and appended video chunk for time: ${startTime}`);
		} catch (error) {
			console.error('Error fetching video chunk:', error.message);
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

document.addEventListener('DOMContentLoaded', () => {
	const videoPlayer = new VideoPlayer(
		'videoPlayer',
		'/run/media/spandan/Spandy HDD/Series/Fullmetal Alchemist Brotherhood/Series/Fullmetal Alchemist Brotherhood - S01E13.mkv',
		'video/mp4; codecs="avc1.42E01E, opus"'
	);
	videoPlayer.initializeMediaSource();
	videoPlayer.addEventListeners();
	videoPlayer.loadInitialMetadata();
	videoPlayer.fetchVideoChunk(0.0);
});
