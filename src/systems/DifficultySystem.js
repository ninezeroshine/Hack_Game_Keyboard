import { BPM, VIRUS } from '../config/constants.js';
import { getKeysForLevel, LEVEL_ORDER } from '../config/keyLevels.js';
import { clamp, lerp } from '../utils/math.js';

/**
 * Difficulty system — manages BPM growth and progressive key unlocking.
 * Sprint mode: fixed curve. Endless: dynamic scaling.
 */
export class DifficultySystem {
    constructor(eventBus) {
        this._bus = eventBus;
        this._baseDifficulty = 'analyst';
        this._layout = 'en';
        this._currentLevelIdx = 0;
        this._activeKeys = [];
        this._bpm = BPM.INITIAL;
        this._spawnRate = 0.5;       // viruses per beat
        this._travelDuration = VIRUS.TRAVEL_TIME_BASE;
    }

    init(difficulty, layout = 'en') {
        this._baseDifficulty = difficulty;
        this._layout = layout;
        this._currentLevelIdx = LEVEL_ORDER.indexOf(difficulty);
        if (this._currentLevelIdx === -1) this._currentLevelIdx = 2; // analyst
        this._activeKeys = [...getKeysForLevel(difficulty, layout)];
        this._bpm = BPM.INITIAL;
        this._spawnRate = 0.5;
        this._travelDuration = VIRUS.TRAVEL_TIME_BASE;
    }

    /**
     * Update difficulty based on elapsed game time.
     * Called every fixed timestep.
     */
    update(elapsedMs) {
        const seconds = elapsedMs / 1000;

        // BPM grows linearly
        this._bpm = clamp(
            BPM.INITIAL + seconds * BPM.GROWTH_PER_SECOND,
            BPM.INITIAL,
            BPM.MAX
        );

        // Spawn rate increases from 0.5 → 2.0 over time
        this._spawnRate = clamp(0.5 + seconds * 0.008, 0.5, 2.0);

        // Travel duration decreases over time
        this._travelDuration = clamp(
            lerp(VIRUS.TRAVEL_TIME_BASE, VIRUS.TRAVEL_TIME_MIN, seconds / 180),
            VIRUS.TRAVEL_TIME_MIN,
            VIRUS.TRAVEL_TIME_BASE
        );
    }

    /**
     * Dynamic key unlocking for endless mode.
     * Adds new keys at score thresholds.
     */
    maybeUnlockKeys(score) {
        const thresholds = [1000, 3000, 6000, 12000, 20000];
        const maxLevelIdx = LEVEL_ORDER.length - 1;

        for (let i = 0; i < thresholds.length && this._currentLevelIdx < maxLevelIdx; i++) {
            if (score >= thresholds[i] && this._currentLevelIdx <= i + 1) {
                const nextIdx = Math.min(i + 1, maxLevelIdx);
                if (nextIdx > this._currentLevelIdx) {
                    this._currentLevelIdx = nextIdx;
                    const newKeys = getKeysForLevel(LEVEL_ORDER[nextIdx], this._layout);
                    const added = newKeys.filter(k => !this._activeKeys.includes(k));
                    this._activeKeys = [...newKeys];

                    if (added.length > 0) {
                        this._bus.emit('difficulty:newKeys', { keys: added, level: LEVEL_ORDER[nextIdx] });
                    }
                }
            }
        }
    }

    get bpm() { return this._bpm; }
    get spawnRate() { return this._spawnRate; }
    get travelDuration() { return this._travelDuration; }
    get activeKeys() { return this._activeKeys; }
    get currentLevel() { return LEVEL_ORDER[this._currentLevelIdx]; }

    reset() {
        this.init(this._baseDifficulty, this._layout);
    }
}
