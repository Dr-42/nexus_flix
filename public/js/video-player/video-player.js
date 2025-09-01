import { VideoMetadata } from './video-metadata.js';
import { VideoResponseParser } from './video-response-parser.js';
import { WebVTTParser } from './webvtt-parser.js';
import { SettingsModal } from '../ui/settings-modal.js';

/**
 * Configuration constants for the video player's buffering and behavior.
 * Tuned values can be adjusted to fit network / UX tradeoffs.
 */
const PLAYER_CONFIG = {
	// Minimum forward buffer required (seconds) before triggering fetch.
	FORWARD_BUFFER_REQUIRED: 20,

	// Standard chunk to fetch when proactively buffering (seconds).
	FORWARD_BUFFER_OPTIMAL: 40,

	// Desired backward buffer kept for quick rewinds (seconds).
	BACKWARD_BUFFER_TARGET: 10,

	// If backward buffered exceeds this, evict older data (seconds).
	MAX_BACKWARD_BUFFER: 60,

	// Small tolerance for float comparisons.
	EPSILON: 1e-6,

	// Minimum size (seconds) of a gap worth fetching.
	MIN_FETCH_GAP: 0.2,

	// Lock granularity for fetch deduplication (seconds).
	// We quantize ranges to this granularity for the fetchLocks keys so
	// near-equal floats map to same key and avoid races.
	LOCK_GRANULARITY: 0.25,
};

export class VideoPlayer {
	constructor(videoElementId, videoPath, watchHistory) {
		// Public inputs
		this.videoElementId = videoElementId;
		this.videoElement = document.getElementById(videoElementId);
		this.videoPath = encodeURIComponent(videoPath);
		this.watchHistory = watchHistory;

		// MSE state
		this.mediaSource = null;
		this.videoSourceBuffer = null;
		this.audioSourceBuffer = null;
		this.videoMetadata = null;
		this.player = null;

		// Playback state
		this.isSeeking = false;
		this.audioIdx = 0;
		this.subtitleTrackElements = [];

		// Fetch management
		this.pendingFetches = []; // { start, end, controller }
		this.fetchLocks = new Set(); // atomic keys for currently scheduled fetch ranges

		// Append bookkeeping to decide timestampOffset safely
		this._lastAppendedEndVideo = null;
		this._lastAppendedEndAudio = null;

		// Reentrancy guards for _checkBuffer
		this._checkInProgress = false;
		this._checkQueued = false;

		// seek debounce
		this.seekDuration = 0;
		this.seekDelay = 500;
		this.seekTimer = null;

		// MIME types (keep as before)
		this.videoMimeType = 'video/mp4; codecs="hvc1.1.6.L93.B0"';
		this.audioMimeType = 'audio/mp4; codecs="opus"';

		// Bind core method
		this._checkBuffer = this._checkBuffer.bind(this);

		if ("MediaSource" in window) {
			this.initializeMediaSource();
		} else {
			console.error("MediaSource API is not supported in this browser.");
		}
	}

	// ---------------- Initialization ----------------

	initializeMediaSource() {
		this.mediaSource = new MediaSource();
		this.videoElement.src = URL.createObjectURL(this.mediaSource);

		this.mediaSource.addEventListener("sourceopen", async () => {
			try {
				await this.loadInitialMetadata();
				this.initVideoJs();
				this.addEventListeners();

				if (this.watchHistory) {
					this.player.currentTime(this.watchHistory.watched_duration);
				}

				await this.fetchSubtitles();
				await this.initializeSourceBuffers();

				// Bootstrap initial buffer check
				await this._checkBuffer();
			} catch (err) {
				console.error("MediaSource initialization error:", err);
			}
		});
	}

	initVideoJs() {
		this.player = videojs(this.videoElementId, {
			html5: { nativeAudioTracks: false, nativeTextTracks: false },
			controls: true,
			autoplay: true,
			playbackRates: [0.5, 1, 1.5, 2],
			controlBar: {
				remainingTimeDisplay: { displayNegative: false },
			},
			userActions: {
				hotkeys: (event) => this.handleHotkeys(event),
			},
		});

		this.setupAudioTracks();
		this.setupSettingsModal();
	}

	addEventListeners() {
		// Reentrancy-safe central planner
		this.videoElement.addEventListener("waiting", () => this._checkBuffer());
		this.videoElement.addEventListener("timeupdate", () => this._checkBuffer());

		this.videoElement.addEventListener("seeking", () => {
			this.isSeeking = true;
			this._abortPendingFetches();
			this._checkBuffer();
		});

		// Replan when playback rate / metadata changes
		this.videoElement.addEventListener("ratechange", () => this._checkBuffer());
		this.videoElement.addEventListener("loadedmetadata", () => this._checkBuffer());
	}

	async initializeSourceBuffers() {
		try {
			this.videoSourceBuffer = this.mediaSource.addSourceBuffer(this.videoMimeType);
			this.videoSourceBuffer.mode = "segments";
			this.videoSourceBuffer.addEventListener("error", (e) => console.error("Video SourceBuffer Error:", e));
			this.videoSourceBuffer.addEventListener("updateend", () => this._checkBuffer());

			this.audioSourceBuffer = this.mediaSource.addSourceBuffer(this.audioMimeType);
			this.audioSourceBuffer.mode = "segments";
			this.audioSourceBuffer.addEventListener("error", (e) => console.error("Audio SourceBuffer Error:", e));
			this.audioSourceBuffer.addEventListener("updateend", () => this._checkBuffer());
		} catch (err) {
			console.error("Error creating source buffers:", err);
		}
	}

	async loadInitialMetadata() {
		try {
			const response = await fetch(`/video-data?path=${this.videoPath}`);
			if (!response.ok) throw new Error("Failed to fetch video metadata");
			const data = await response.json();
			this.videoMetadata = VideoMetadata.fromJson(data);
			if (Number.isFinite(this.videoMetadata.duration)) {
				this.mediaSource.duration = this.videoMetadata.duration;
			}
		} catch (err) {
			console.error("Error loading metadata:", err);
		}
	}

	// ---------------- Master buffering logic (reentrancy-safe) ----------------

	/**
	 * Main planner. Safe for multiple rapid calls: avoids concurrent runs and queues one follow-up.
	 */
	async _checkBuffer() {
		// Queue if already running
		if (this._checkInProgress) {
			this._checkQueued = true;
			return;
		}
		this._checkInProgress = true;
		this._checkQueued = false;

		try {
			// Basic guards
			if (!this.player || (!this.videoSourceBuffer && !this.audioSourceBuffer)) return;

			const currentTime = this.player.currentTime();
			const D = Number.isFinite(this.mediaSource.duration) ? this.mediaSource.duration : Infinity;
			const cfg = PLAYER_CONFIG;

			// Build merged coverage: intersection(audio,video) if both exist; else whichever exists; union with pending
			const mergedCoverage = this._getMergedBufferedIncludingPending();

			// If nothing buffered/pending at startup -> bootstrap fetch
			if (mergedCoverage.length === 0) {
				const start = Math.max(0, currentTime - cfg.BACKWARD_BUFFER_TARGET);
				const dur = Math.min(cfg.FORWARD_BUFFER_OPTIMAL + cfg.BACKWARD_BUFFER_TARGET, D - start);
				if (dur > cfg.MIN_FETCH_GAP && !this._isRangePending(start, start + dur)) {
					await this._atomicFetch(start, start + dur);
				}
				return;
			}

			// Is playback inside coverage? allow EPS tolerance
			const inCoverage = mergedCoverage.some(r => (currentTime + cfg.EPSILON >= r.start) && (currentTime <= r.end + cfg.EPSILON));
			if (!inCoverage) {
				// Emergency recovery: fetch around currentTime
				const start = Math.max(0, currentTime - cfg.BACKWARD_BUFFER_TARGET);
				const dur = Math.min(cfg.FORWARD_BUFFER_OPTIMAL + cfg.BACKWARD_BUFFER_TARGET, D - start);
				if (dur > cfg.MIN_FETCH_GAP && !this._isRangePending(start, start + dur)) {
					await this._atomicFetch(start, start + dur);
				}
				return;
			}

			// Extend forward buffer if needed
			const continuousEnd = this._getContinuousBufferEnd(currentTime, mergedCoverage);
			const bufferedAhead = continuousEnd - currentTime;

			if (bufferedAhead < cfg.FORWARD_BUFFER_REQUIRED - cfg.EPSILON) {
				const fetchStart = continuousEnd;
				const fetchEnd = Math.min(D, continuousEnd + cfg.FORWARD_BUFFER_OPTIMAL);
				if ((fetchEnd - fetchStart) > cfg.MIN_FETCH_GAP && !this._isRangePending(fetchStart, fetchEnd) && !this._isCoveredByBuffered(fetchStart, fetchEnd)) {
					await this._atomicFetch(fetchStart, fetchEnd);
				}
			}

			// Evict old backward buffer if it exceeds MAX_BACKWARD_BUFFER (do not evict while updating)
			if (!this.videoSourceBuffer?.updating && !this.audioSourceBuffer?.updating) {
				const videoBuf = this._getBufferedList(this.videoSourceBuffer);
				if (videoBuf.length > 0) {
					const earliestStart = videoBuf[0].start;
					if ((currentTime - earliestStart) > PLAYER_CONFIG.MAX_BACKWARD_BUFFER + PLAYER_CONFIG.EPSILON) {
						// remove until currentTime - BACKWARD_BUFFER_TARGET but not beyond earliestStart
						const removalEnd = Math.max(earliestStart, currentTime - PLAYER_CONFIG.BACKWARD_BUFFER_TARGET);
						if (removalEnd - earliestStart > PLAYER_CONFIG.MIN_FETCH_GAP) {
							await this._removeBufferRange(earliestStart, removalEnd);
						}
					}
				}
			}

			// Clear seeking flag if now buffered
			if (this.isSeeking) {
				const nowBuffered = this._getMergedBufferedIncludingPending().some(r => (currentTime + cfg.EPSILON >= r.start) && (currentTime <= r.end + cfg.EPSILON));
				if (nowBuffered) this.isSeeking = false;
			}
		} catch (err) {
			console.error("Error in _checkBuffer:", err);
		} finally {
			this._checkInProgress = false;
			if (this._checkQueued) {
				this._checkQueued = false;
				setTimeout(() => this._checkBuffer(), 0);
			}
		}
	}

	// ---------------- Fetch atomicity & network ----------------

	/**
	 * Quantize start/end to a lock key to avoid races with nearly-equal floats.
	 */
	_makeRangeKey(start, end) {
		const g = PLAYER_CONFIG.LOCK_GRANULARITY;
		const qs = Math.round(start / g) * g;
		const qe = Math.round(end / g) * g;
		return `${qs.toFixed(3)}-${qe.toFixed(3)}`;
	}

	/**
	 * Atomic fetch wrapper. Ensures only one fetch per quantized range runs at a time,
	 * tracks pendingFetches (for aborts & merged-coverage), and always cleans up.
	 *
	 * @param {number} start inclusive start time
	 * @param {number} end exclusive end time
	 */
	async _atomicFetch(start, end) {
		const D = Number.isFinite(this.mediaSource.duration) ? this.mediaSource.duration : Infinity;
		const s = Math.max(0, start);
		const e = Math.min(D, end);
		const dur = e - s;
		if (dur <= PLAYER_CONFIG.MIN_FETCH_GAP) return;

		const key = this._makeRangeKey(s, e);

		// Quick pre-check against pending/covered
		if (this._isRangePending(s, e)) {
			// Already scheduled/ongoing (overlap wise)
			return;
		}
		if (this._isCoveredByBuffered(s, e)) {
			// Already covered by buffered+panding coverage
			return;
		}

		// Acquire lock (quantized)
		if (this.fetchLocks.has(key)) {
			// Another concurrent call already claimed this quantized range.
			return;
		}
		this.fetchLocks.add(key);

		// Create abort controller + record pending
		const controller = new AbortController();
		const record = { start: s, end: e, controller };
		this.pendingFetches.push(record);

		try {
			console.log(`Fetching chunk: [${s.toFixed(3)} - ${e.toFixed(3)}]`);
			console.log(`Pending fetches: ${this.pendingFetches.map(p => `[${p.start.toFixed(1)}-${p.end.toFixed(1)}]`).join(", ")}`);

			const resp = await fetch(`/video?path=${this.videoPath}&timestamp=${s}&duration=${dur}`, { signal: controller.signal });
			if (!resp.ok) throw new Error(`Fetch failed (${resp.status})`);
			const arrayBuffer = await resp.arrayBuffer();

			const parser = new VideoResponseParser(arrayBuffer);
			const parsed = parser.parse();

			// Wait for buffers to become appendable
			await this._waitForBuffersReady();

			// Safely set timestampOffset if non-contiguous
			this._safeSetTimestampOffsetIfNeeded(this.videoSourceBuffer, s, '_lastAppendedEndVideo');
			this._safeSetTimestampOffsetIfNeeded(this.audioSourceBuffer, s, '_lastAppendedEndAudio');

			// Append video/audio in parallel if present
			const appendPromises = [];
			if (parsed.videoData && this.videoSourceBuffer) {
				appendPromises.push(this._appendToBuffer(this.videoSourceBuffer, parsed.videoData).then(() => {
					this._lastAppendedEndVideo = Math.max(this._lastAppendedEndVideo || 0, s + dur);
				}));
			}
			if (parsed.audioTracks && parsed.audioTracks[this.audioIdx] && this.audioSourceBuffer) {
				appendPromises.push(this._appendToBuffer(this.audioSourceBuffer, parsed.audioTracks[this.audioIdx].data).then(() => {
					this._lastAppendedEndAudio = Math.max(this._lastAppendedEndAudio || 0, s + dur);
				}));
			}
			await Promise.all(appendPromises);

			// Subtitles
			try { this._processSubtitles(parsed); } catch (err) { console.warn("Subtitle processing error:", err); }

		} catch (err) {
			if (err.name === 'AbortError') {
				console.log(`Fetch aborted for [${s.toFixed(3)}-${e.toFixed(3)}]`);
			} else {
				console.error("Error during fetch/append:", err);
			}
		} finally {
			// Remove pending record & release lock
			this.pendingFetches = this.pendingFetches.filter(p => p !== record);
			this.fetchLocks.delete(key);

			// Trigger a re-evaluation of buffer
			setTimeout(() => this._checkBuffer(), 0);
		}
	}

	// ---------------- Interval helpers & coverage ----------------

	_isRangePending(start, end) {
		const eps = Math.max(PLAYER_CONFIG.EPSILON, 0.001);
		return this.pendingFetches.some(p => !(end <= p.start + eps || start >= p.end - eps));
	}

	_getBufferedList(sourceBuffer) {
		const out = [];
		if (!sourceBuffer) return out;
		try {
			const ranges = sourceBuffer.buffered;
			for (let i = 0; i < ranges.length; i++) {
				out.push({ start: ranges.start(i), end: ranges.end(i) });
			}
			return this._mergeRanges(out);
		} catch (err) {
			// accessing buffered sometimes throws; be conservative
			return [];
		}
	}

	// merged coverage includes pending fetches so planner avoids duplicate scheduling
	_getMergedBufferedIncludingPending() {
		const videoBuf = this._getBufferedList(this.videoSourceBuffer);
		const audioBuf = this._getBufferedList(this.audioSourceBuffer);

		let primary;
		if (videoBuf.length > 0 && audioBuf.length > 0) {
			primary = this._intersectRanges(videoBuf, audioBuf);
		} else if (videoBuf.length > 0) {
			primary = videoBuf.slice();
		} else if (audioBuf.length > 0) {
			primary = audioBuf.slice();
		} else {
			primary = [];
		}

		const pendingRanges = this.pendingFetches.map(p => ({ start: p.start, end: p.end }));
		return this._mergeRanges(primary.concat(pendingRanges));
	}

	_isCoveredByBuffered(start, end) {
		const eps = Math.max(PLAYER_CONFIG.EPSILON, 0.001);
		const covered = this._getMergedBufferedIncludingPending();
		return covered.some(c => (c.start - eps <= start) && (c.end + eps >= end));
	}

	_mergeRanges(ranges) {
		if (!ranges || ranges.length === 0) return [];
		const EPS = PLAYER_CONFIG.EPSILON;
		const sorted = ranges.slice().sort((a, b) => a.start - b.start);
		const out = [];
		let cur = { ...sorted[0] };
		for (let i = 1; i < sorted.length; i++) {
			const r = sorted[i];
			if (r.start <= cur.end + EPS) cur.end = Math.max(cur.end, r.end);
			else { out.push(cur); cur = { ...r }; }
		}
		out.push(cur);
		return out;
	}

	_intersectRanges(a, b) {
		if (!a || !b || a.length === 0 || b.length === 0) return [];
		const aa = this._mergeRanges(a);
		const bb = this._mergeRanges(b);
		const out = [];
		let i = 0, j = 0;
		const EPS = PLAYER_CONFIG.EPSILON;
		while (i < aa.length && j < bb.length) {
			const A = aa[i], B = bb[j];
			const s = Math.max(A.start, B.start);
			const e = Math.min(A.end, B.end);
			if (e > s + EPS) out.push({ start: s, end: e });
			if (A.end < B.end - EPS) i++; else j++;
		}
		return out;
	}

	_getContinuousBufferEnd(currentTime, mergedRanges) {
		const EPS = PLAYER_CONFIG.EPSILON;
		for (const r of mergedRanges) {
			if (currentTime + EPS >= r.start && currentTime <= r.end + EPS) return r.end;
		}
		return currentTime;
	}

	// ---------------- Append / remove helpers ----------------

	_waitForBuffersReady() {
		const promises = [];
		if (this.videoSourceBuffer?.updating) promises.push(new Promise(res => this.videoSourceBuffer.addEventListener('updateend', res, { once: true })));
		if (this.audioSourceBuffer?.updating) promises.push(new Promise(res => this.audioSourceBuffer.addEventListener('updateend', res, { once: true })));
		return Promise.all(promises);
	}

	_waitForBufferNotUpdating(buffer) {
		if (!buffer) return Promise.resolve();
		if (!buffer.updating) return Promise.resolve();
		return new Promise(res => buffer.addEventListener('updateend', res, { once: true }));
	}

	async _appendToBuffer(buffer, data) {
		if (!buffer || !data) return;
		await this._waitForBufferNotUpdating(buffer);
		return new Promise((resolve, reject) => {
			const onEnd = () => { buffer.removeEventListener('updateend', onEnd); buffer.removeEventListener('error', onErr); resolve(); };
			const onErr = (e) => { buffer.removeEventListener('updateend', onEnd); buffer.removeEventListener('error', onErr); reject(e); };
			buffer.addEventListener('updateend', onEnd);
			buffer.addEventListener('error', onErr);
			try { buffer.appendBuffer(data); } catch (err) { buffer.removeEventListener('updateend', onEnd); buffer.removeEventListener('error', onErr); reject(err); }
		});
	}

	_safeSetTimestampOffsetIfNeeded(buffer, desiredStart, lastAppendedKey) {
		if (!buffer) return;
		const EPS = PLAYER_CONFIG.EPSILON;
		const buffered = this._getBufferedList(buffer);
		if (buffered.length === 0) {
			try { buffer.timestampOffset = desiredStart; } catch (err) { /* ignore browser quirks */ }
			return;
		}
		const lastBufferedEnd = buffered[buffered.length - 1].end;
		const lastAppended = this[lastAppendedKey] || lastBufferedEnd;
		if (Math.abs(desiredStart - lastAppended) > Math.max(EPS, 0.05)) {
			try { buffer.timestampOffset = desiredStart; } catch (err) { console.warn("timestampOffset set failed:", err); }
		}
	}

	async _removeBufferRange(start, end) {
		if (!this.videoSourceBuffer && !this.audioSourceBuffer) return;
		// Wait for any ongoing updates first
		await this._waitForBuffersReady();

		const safeRemove = (buffer, s, e) => {
			if (!buffer) return Promise.resolve();
			return new Promise((resolve) => {
				const onEnd = () => { buffer.removeEventListener('updateend', onEnd); resolve(); };
				buffer.addEventListener('updateend', onEnd, { once: true });
				try { buffer.remove(s, e); }
				catch (err) { buffer.removeEventListener('updateend', onEnd); console.warn("SourceBuffer.remove threw:", err); resolve(); }
			});
		};

		await Promise.all([ safeRemove(this.videoSourceBuffer, start, end), safeRemove(this.audioSourceBuffer, start, end) ]);
	}

	// ---------------- Pending control ----------------

	_abortPendingFetches() {
		this.pendingFetches.forEach(p => {
			try { p.controller.abort(); } catch (_) {}
		});
		this.pendingFetches = [];
		this.fetchLocks.clear();
	}

	// ---------------- Subtitles & tracks ----------------

	async fetchSubtitles() {
		const subtitleTracks = this.videoMetadata?.getSubtitleTracks?.() || [];
		subtitleTracks.forEach((track, i) => {
			if (this.videoMetadata?.unavailableSubs?.includes?.(i)) return;
			const vjsTrack = this.player.addRemoteTextTrack({ kind: "subtitles", label: track.label, language: track.language }, false);
			this.subtitleTrackElements.push({ idx: i, element: vjsTrack });
		});
	}

	_processSubtitles(parsedData) {
		if (!parsedData) return;
		const vttParser = new WebVTTParser();
		for (let i = 0; i < (parsedData.numSubTracks || 0); i++) {
			const subData = parsedData.subtitleTracks?.[i];
			if (!subData) continue;
			const trackInfo = this.subtitleTrackElements.find(t => t.idx === Number(subData.id));
			if (!trackInfo?.element?.track) continue;
			const text = new TextDecoder("utf-8").decode(subData.data);
			const parsed = vttParser.parse(text, "subtitles");
			const cues = parsed?.cues || [];
			const textTrack = trackInfo.element.track;
			// Remove existing cues safely
			try {
				const existing = Array.from(textTrack.cues || []);
				for (const cue of existing) {
					try { textTrack.removeCue(cue); } catch (_) {}
				}
			} catch (_) {}
			// Add new cues
			for (const cue of cues) {
				try { textTrack.addCue(cue); } catch (_) {}
			}
		}
	}

	// ---------------- Audio track management ----------------

	async switchAudioTrack() {
		console.log(`Switching to audio track ID: ${this.audioIdx}`);
		this._abortPendingFetches();
		await this._clearBuffers();
		await this._checkBuffer();
	}

	setupAudioTracks() {
		const audioTracks = this.videoMetadata?.getAudioTracks?.() || [];
		const audioTrackList = this.player.audioTracks();
		audioTracks.forEach(track => {
			audioTrackList.addTrack(new videojs.AudioTrack({ id: track.id, label: track.label, language: track.language, enabled: track.id === this.audioIdx }));
		});
		audioTrackList.addEventListener("change", () => {
			for (let i = 0; i < audioTrackList.length; i++) {
				if (audioTrackList[i].enabled) {
					const newAudioTrackId = audioTracks[i].id;
					if (newAudioTrackId !== this.audioIdx) {
						this.audioIdx = newAudioTrackId;
						this.switchAudioTrack();
					}
					break;
				}
			}
		});
	}

	// ---------------- UI & hotkeys ----------------

	setupSettingsModal() {
		this.settingsModal = new SettingsModal(this.player);
		const settingsButton = document.createElement('button');
		settingsButton.className = 'vjs-floating-settings-btn';
		settingsButton.innerHTML = 'Themes';
		settingsButton.title = 'Video Player Themes (Press T)';
		Object.assign(settingsButton.style, {
			position: 'absolute', top: '15px', left: '15px', zIndex: '1000',
			background: 'rgba(0,0,0,0.8)', color: 'white',
			border: '1px solid rgba(255,255,255,0.3)', padding: '8px 12px',
			borderRadius: '6px', cursor: 'pointer'
		});
		settingsButton.addEventListener('click', (e) => { e.stopPropagation(); this.settingsModal.show(); });
		const playerContainer = this.player.el().parentElement || this.player.el();
		playerContainer.style.position = 'relative';
		playerContainer.appendChild(settingsButton);
	}

	handleHotkeys(event) {
		const key = event.key, ctrl = event.ctrlKey, shift = event.shiftKey;
		switch (key) {
			case " ":
				event.preventDefault();
				this.player.paused() ? this.player.play() : this.player.pause();
				break;
			case "ArrowLeft":
				this.debounceSeek(ctrl ? -10 : (shift ? -1 : -5));
				break;
			case "ArrowRight":
				this.debounceSeek(ctrl ? 10 : (shift ? 1 : 5));
				break;
			case "ArrowUp":
				this.player.volume(Math.min(this.player.volume() + 0.1, 1));
				break;
			case "ArrowDown":
				this.player.volume(Math.max(this.player.volume() - 0.1, 0));
				break;
			case "f":
				this.player.isFullscreen() ? this.player.exitFullscreen() : this.player.requestFullscreen();
				break;
			case "t":
				event.preventDefault();
				if (this.settingsModal) this.settingsModal.show();
				break;
		}
	}

	debounceSeek(duration) {
		this.seekDuration += duration;
		clearTimeout(this.seekTimer);
		this.seekTimer = setTimeout(() => {
			const newTime = this.player.currentTime() + this.seekDuration;
			this.player.currentTime(newTime);
			this.seekDuration = 0;
			this.seekTimer = null;
		}, this.seekDelay);
	}

	// ---------------- Buffer utilities ----------------

	async _clearBuffers() {
		if (!this.videoSourceBuffer && !this.audioSourceBuffer) return;
		const duration = Number.isFinite(this.mediaSource.duration) ? this.mediaSource.duration : null;
		if (!duration) {
			await this._removeBufferRange(0, 1e9).catch(() => {});
			return;
		}
		await this._removeBufferRange(0, duration).catch(() => {});
	}

	debugState() {
		return {
			pendingFetches: this.pendingFetches.slice(),
			fetchLocks: Array.from(this.fetchLocks),
			videoBuffered: this._getBufferedList(this.videoSourceBuffer),
			audioBuffered: this._getBufferedList(this.audioSourceBuffer),
			playerCurrentTime: this.player?.currentTime?.() ?? this.videoElement?.currentTime,
		};
	}
}

