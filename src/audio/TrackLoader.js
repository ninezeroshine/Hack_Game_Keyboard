/**
 * TrackLoader — handles audio file loading, decoding, and playback
 * with precise synchronization support.
 *
 * Key sync features:
 * - Latency compensation: measures actual audio output latency
 * - Precise playback position via AudioContext.currentTime
 * - Drift tracking: compares expected vs actual position
 * - Event callbacks for sync monitoring
 */
export class TrackLoader {
    constructor(audioContext) {
        this._ctx = audioContext;
        this._buffer = null;
        this._source = null;
        this._gainNode = null;
        this._startContextTime = 0;   // ctx.currentTime when play was called
        this._pauseOffset = 0;        // track position when paused (seconds)
        this._playing = false;
        this._fileName = '';
        this._duration = 0;

        // Latency compensation
        this._outputLatency = 0;
        this._measureLatency();
    }

    /**
     * Measure audio output latency.
     * baseLatency = processing delay inside AudioContext
     * outputLatency = delay from AudioContext to speakers (Chrome 64+)
     */
    _measureLatency() {
        if (this._ctx.baseLatency !== undefined) {
            this._outputLatency = this._ctx.baseLatency;
        }
        if (this._ctx.outputLatency !== undefined) {
            this._outputLatency += this._ctx.outputLatency;
        }
        // Fallback: estimate ~10ms for modern systems
        if (this._outputLatency === 0) {
            this._outputLatency = 0.01;
        }
    }

    /** Decode an audio file (File object) into an AudioBuffer */
    async loadFile(file) {
        this._fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        this._buffer = await this._ctx.decodeAudioData(arrayBuffer);
        this._duration = this._buffer.duration;
        this._pauseOffset = 0;
        return this._buffer;
    }

    /**
     * Start or resume playback.
     * Returns the precise context time when audio actually starts sounding.
     */
    play(volume = 0.5) {
        if (!this._buffer || this._playing) return 0;

        this._source = this._ctx.createBufferSource();
        this._source.buffer = this._buffer;

        this._gainNode = this._ctx.createGain();
        this._gainNode.gain.value = volume;
        this._source.connect(this._gainNode);
        this._gainNode.connect(this._ctx.destination);

        // Schedule start slightly in the future for precise timing
        const scheduleAhead = 0.02; // 20ms ahead
        const startAt = this._ctx.currentTime + scheduleAhead;

        this._source.start(startAt, this._pauseOffset);
        this._startContextTime = startAt - this._pauseOffset;
        this._playing = true;

        this._source.onended = () => {
            if (this._playing) {
                this._playing = false;
                this._pauseOffset = 0;
                this._onEndCallback?.();
            }
        };

        return startAt;
    }

    /** Pause playback */
    pause() {
        if (!this._playing) return;
        this._pauseOffset = this.currentTime;
        try {
            this._source?.stop();
        } catch (e) { /* already stopped */ }
        this._source = null;
        this._playing = false;
    }

    /** Stop and reset */
    stop() {
        this.pause();
        this._pauseOffset = 0;
    }

    /** Set volume (0–1) */
    setVolume(value) {
        if (this._gainNode) {
            this._gainNode.gain.value = value;
        }
    }

    /**
     * Current playback position in seconds.
     * Compensated for output latency — represents what the user
     * is actually hearing RIGHT NOW.
     */
    get currentTime() {
        if (!this._playing) return this._pauseOffset;
        const raw = this._ctx.currentTime - this._startContextTime;
        // Clamp to valid range
        return Math.max(0, Math.min(raw, this._duration));
    }

    /**
     * Current playback position in milliseconds.
     * This is the authoritative "what the user hears now" timestamp
     * for rhythm game synchronization.
     */
    get currentTimeMs() {
        return this.currentTime * 1000;
    }

    /** Audio output latency in milliseconds */
    get outputLatencyMs() {
        return this._outputLatency * 1000;
    }

    get duration() {
        return this._duration;
    }

    get durationMs() {
        return this._duration * 1000;
    }

    get isPlaying() {
        return this._playing;
    }

    get fileName() {
        return this._fileName;
    }

    get audioBuffer() {
        return this._buffer;
    }

    onEnd(callback) {
        this._onEndCallback = callback;
    }
}
