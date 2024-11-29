const videoElement = document.getElementById('videoPlayer');
const videoUrl = 'http://localhost:3000/video/sample.mp4'; // Adjust as needed
const durationUrl = 'http://localhost:3000/video-duration/sample.mp4';
const videoMimeType = 'video/mp4; codecs="avc1.42E01E, opus"';
let sourceBuffer;
let mediaSource;
let isFetching = false; // Prevent simultaneous fetches

if ('MediaSource' in window) {
	mediaSource = new MediaSource();
	videoElement.src = URL.createObjectURL(mediaSource);

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
			// Clear existing buffer
			sourceBuffer.abort();
			//let newTime = Math.ceil(currentTime);
			//return the closest 10 seconds
			let newTime = Math.ceil(currentTime / 10) * 10;
			//await videoElement.pause();
			await fetchVideoChunk(newTime);
			//await videoElement.play();
		} catch (error) {
			console.error("Error during reload:", error.message);
		}
	}

	mediaSource.addEventListener('sourceopen', async () => {
		try {
			// Set video duration
			const response = await fetch(durationUrl);
			if (!response.ok) throw new Error("Failed to fetch video duration");
			const duration = parseFloat(await response.text());
			mediaSource.duration = duration;

			// Initialize SourceBuffer
			sourceBuffer = mediaSource.addSourceBuffer(videoMimeType);
			sourceBuffer.mode = 'sequence';

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
		const bufferEnd = sourceBuffer.buffered.length > 0
			? sourceBuffer.buffered.end(0)
			: 0;

		if (currentTime >= bufferEnd - 6) {
			await reloadVideoChunk(currentTime);
			await videoElement.play();
		}
	});

	const seeking = async () => {
		const newTime = videoElement.currentTime;
		console.log(`Seeking to time: ${newTime}`);
		// if (!sourceBuffer || sourceBuffer.updating || isFetching) {
		// 	let cause = isFetching ? "fetching" : "updating";
		// 	console.log(`Cannot seek while ${cause}`);
		// 	return;
		// }


		//try {
		// Clear existing buffer
		console.log("Current timestamp offset:", sourceBuffer.timestampOffset);
		sourceBuffer.abort();
		//sourceBuffer.remove(0, sourceBuffer.buffered.end(0));
		await videoElement.pause();
		await fetchVideoChunk(newTime);
		sourceBuffer.timestampOffset = newTime;
		videoElement.currentTime = newTime;
		console.log("New timestamp offset:", sourceBuffer.timestampOffset);
		await videoElement.play();
		// } catch (error) {
		// 	console.error("Error during seeking:", error.message);
		// }
	}
	videoElement.addEventListener('seeking', seeking);
} else {
	console.error('MediaSource API is not supported in this browser.');
}
