const videoElement = document.getElementById('videoPlayer');
const videoUrl = '/video/sample.mp4'; // Adjust as needed
const durationUrl = '/video-duration/sample.mp4';
const videoMimeType = 'video/mp4; codecs="avc1.42E01E, opus"';
let sourceBuffer;
let mediaSource;
let isFetching = false;
let videoDuration = 0;
let isSeeking = false;

if ('MediaSource' in window) {
	mediaSource = new MediaSource();
	videoElement.src = URL.createObjectURL(mediaSource);

	videoElement.addEventListener('seeking', () => {
		isSeeking = true;
	});

	videoElement.addEventListener('seeked', () => {
		isSeeking = false;
	});

	const fetchVideoChunk = async (startTime) => {
		if (isFetching || !sourceBuffer || sourceBuffer.updating) return;
		isFetching = true;
		try {
			console.log(`Fetching video chunk for time: ${startTime}`);
			const response = await fetch(`${videoUrl}?timestamp=${startTime}`);
			if (!response.ok) throw new Error("Failed to fetch video chunk");

			const data = await response.arrayBuffer();
			sourceBuffer.appendBuffer(data);
			console.log(`Fetched and appended video chunk for time: ${startTime}`);
		} catch (error) {
			console.error("Error fetching video chunk:", error.message);
		} finally {
			isFetching = false;
		}
	};

	const reloadVideoChunk = async (currentTime) => {
		try {
			sourceBuffer.abort();
			//return the closest 10 seconds
			let newTime = Math.ceil(currentTime / 10) * 10;
			sourceBuffer.timestampOffset = newTime;
			await fetchVideoChunk(newTime);
			return newTime;
		} catch (error) {
			console.error("Error during reload:", error.message);
		}
	}

	const getRelevantBufferEnd = () => {
		let bufferEnd = 0;
		for (let i = 0; i < sourceBuffer.buffered.length; i++) {
			const start = sourceBuffer.buffered.start(i);
			const end = sourceBuffer.buffered.end(i);
			if (start <= videoElement.currentTime && end > bufferEnd) {
				bufferEnd = end;
			}
		}
		return bufferEnd;
	}

	mediaSource.addEventListener('sourceopen', async () => {
		try {
			// Set video duration
			const response = await fetch(durationUrl);
			if (!response.ok) throw new Error("Failed to fetch video duration");
			videoDuration = parseFloat(await response.text());
			mediaSource.duration = videoDuration;

			// Initialize SourceBuffer
			sourceBuffer = mediaSource.addSourceBuffer(videoMimeType);
			//sourceBuffer.mode = 'sequence';

			sourceBuffer.addEventListener('error', (e) => {
				console.error("SourceBuffer error:", e);
			});

			// Fetch initial chunk
			await fetchVideoChunk(0.0);
		} catch (error) {
			console.error("Error initializing MediaSource:", error.message);
		}
	});

	videoElement.addEventListener('timeupdate', async () => {
		if (!sourceBuffer || sourceBuffer.updating || isFetching) return;

		const currentTime = videoElement.currentTime;
		// const bufferEnd = sourceBuffer.buffered.length > 0
		// 	? sourceBuffer.buffered.end(0)
		// 	: 0;
		const bufferEnd = getRelevantBufferEnd();
		if (currentTime >= bufferEnd - 2) {
			let newTime = await reloadVideoChunk(currentTime);
			if (isSeeking) {
				console.log(`Seeking to time: ${newTime}`);
				isSeeking = false;
				videoElement.currentTime = newTime;
			}

			await videoElement.play();
		}
	});

} else {
	console.error('MediaSource API is not supported in this browser.');
}
