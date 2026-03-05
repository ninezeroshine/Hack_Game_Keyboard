/**
 * Procedural sound generation via Web Audio API.
 * All SFX are synthesized — zero asset files.
 */
export class SoundGen {
    constructor(audioCtx) {
        this._ctx = audioCtx;
    }

    /** Short click sound for key press */
    tick(volume = 0.3) {
        const ctx = this._ctx;
        const now = ctx.currentTime;

        // White noise burst
        const bufferSize = ctx.sampleRate * 0.03;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 3000;

        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start(now);
        source.stop(now + 0.03);
    }

    /** Successful block — clean "clack" */
    clack(volume = 0.4) {
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    /** Perfect hit — bright ping */
    perfectPing(volume = 0.35) {
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1800, now);
        osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain).connect(ctx.destination);
        osc2.connect(gain);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.15);
        osc2.stop(now + 0.15);
    }

    /** Miss / error — low harsh buzz */
    buzz(volume = 0.3) {
        const ctx = this._ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        const distortion = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = (Math.PI + 50) * x / (Math.PI + 50 * Math.abs(x));
        }
        distortion.curve = curve;

        osc.connect(distortion).connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }
}
