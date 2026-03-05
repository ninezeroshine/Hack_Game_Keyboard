/**
 * Adaptive tension layer — background drone that intensifies with game speed.
 * Uses low-frequency oscillator + LFO modulation.
 */
export class TensionLayer {
    constructor(audioCtx) {
        this._ctx = audioCtx;
        this._osc = null;
        this._lfo = null;
        this._gainNode = null;
        this._filterNode = null;
        this._playing = false;
        this._targetVolume = 0;
    }

    start(volume = 0.08) {
        if (this._playing) return;
        const ctx = this._ctx;

        // Base drone
        this._osc = ctx.createOscillator();
        this._osc.type = 'sine';
        this._osc.frequency.value = 55;

        // LFO for subtle pulsing
        this._lfo = ctx.createOscillator();
        this._lfo.type = 'sine';
        this._lfo.frequency.value = 0.5;

        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 10;

        this._lfo.connect(lfoGain);
        lfoGain.connect(this._osc.frequency);

        // Filter
        this._filterNode = ctx.createBiquadFilter();
        this._filterNode.type = 'lowpass';
        this._filterNode.frequency.value = 200;

        // Output gain
        this._gainNode = ctx.createGain();
        this._gainNode.gain.value = 0;
        this._targetVolume = volume;

        this._osc.connect(this._filterNode)
            .connect(this._gainNode)
            .connect(ctx.destination);

        this._osc.start();
        this._lfo.start();
        this._playing = true;

        // Fade in
        this._gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2);
    }

    /** Set intensity 0–1, maps to volume and filter */
    setIntensity(intensity) {
        if (!this._playing) return;
        const ctx = this._ctx;
        const vol = 0.03 + intensity * 0.12;
        const freq = 100 + intensity * 400;
        const lfoSpeed = 0.3 + intensity * 2;

        this._gainNode.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.5);
        this._filterNode.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 0.5);
        this._lfo.frequency.linearRampToValueAtTime(lfoSpeed, ctx.currentTime + 0.5);
    }

    stop() {
        if (!this._playing) return;
        const ctx = this._ctx;
        this._gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        setTimeout(() => {
            this._osc?.stop();
            this._lfo?.stop();
            this._playing = false;
        }, 1200);
    }
}
