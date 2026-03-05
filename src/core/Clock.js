import { GAME } from '../config/constants.js';

/**
 * Fixed-timestep clock with BPM tracking.
 * Logic updates at fixed rate, rendering interpolates.
 */
export class Clock {
    constructor() {
        this.elapsed = 0;           // total game time in ms
        this.delta = 0;             // raw frame delta
        this.accumulator = 0;
        this.bpm = 100;
        this.beatElapsed = 0;       // ms since last beat
        this.beatCount = 0;
        this._lastTime = 0;
        this._running = false;
    }

    get beatInterval() {
        return 60_000 / this.bpm;   // ms per beat
    }

    start() {
        this._lastTime = performance.now();
        this._running = true;
        this.elapsed = 0;
        this.accumulator = 0;
        this.beatElapsed = 0;
        this.beatCount = 0;
    }

    pause() {
        this._running = false;
    }

    resume() {
        this._lastTime = performance.now();
        this._running = true;
    }

    /**
     * Call each frame. Returns number of fixed steps to process.
     * @returns {{ steps: number, alpha: number, beatTick: boolean }}
     */
    tick(now) {
        if (!this._running) return { steps: 0, alpha: 0, beatTick: false };

        this.delta = Math.min(now - this._lastTime, GAME.MAX_DELTA);
        this._lastTime = now;
        this.elapsed += this.delta;
        this.accumulator += this.delta;

        const steps = Math.floor(this.accumulator / GAME.FIXED_TIMESTEP);
        this.accumulator -= steps * GAME.FIXED_TIMESTEP;

        // Beat tracking
        this.beatElapsed += this.delta;
        let beatTick = false;
        if (this.beatElapsed >= this.beatInterval) {
            this.beatElapsed -= this.beatInterval;
            this.beatCount++;
            beatTick = true;
        }

        const alpha = this.accumulator / GAME.FIXED_TIMESTEP;
        return { steps, alpha, beatTick };
    }

    setBPM(bpm) {
        this.bpm = bpm;
    }
}
