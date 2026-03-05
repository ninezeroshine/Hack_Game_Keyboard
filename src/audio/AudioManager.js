import { SoundGen } from './SoundGen.js';
import { TensionLayer } from './TensionLayer.js';

/**
 * Audio manager — initializes AudioContext on first interaction,
 * exposes sound methods, handles volume.
 */
export class AudioManager {
    constructor() {
        this._ctx = null;
        this._soundGen = null;
        this._tension = null;
        this._masterVolume = 0.7;
        this._initialized = false;
    }

    /** Must be called from a user gesture (click/keydown) */
    init() {
        if (this._initialized) {
            if (this._ctx && this._ctx.state === 'suspended') {
                this._ctx.resume();
            }
            return;
        }

        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._soundGen = new SoundGen(this._ctx);
        this._tension = new TensionLayer(this._ctx);
        this._initialized = true;

        // Resume if suspended
        if (this._ctx.state === 'suspended') {
            this._ctx.resume();
        }
    }

    get isReady() {
        return this._initialized;
    }

    setVolume(value) {
        this._masterVolume = value / 100; // 0–100 → 0–1
    }

    playTick() {
        if (!this._initialized) return;
        this._soundGen.tick(0.2 * this._masterVolume);
    }

    playClack() {
        if (!this._initialized) return;
        this._soundGen.clack(0.4 * this._masterVolume);
    }

    playPerfect() {
        if (!this._initialized) return;
        this._soundGen.perfectPing(0.35 * this._masterVolume);
    }

    playBuzz() {
        if (!this._initialized) return;
        this._soundGen.buzz(0.3 * this._masterVolume);
    }

    startTension() {
        if (!this._initialized) return;
        this._tension.start(0.08 * this._masterVolume);
    }

    setTensionIntensity(intensity) {
        this._tension?.setIntensity(intensity);
    }

    stopTension() {
        this._tension?.stop();
    }

    suspend() {
        this._ctx?.suspend();
    }

    resume() {
        this._ctx?.resume();
    }
}
