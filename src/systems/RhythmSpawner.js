import { randomItem } from '../utils/math.js';

/**
 * RhythmSpawner — schedules virus spawns from a pre-analyzed beat map
 * with precise audio-visual synchronization.
 *
 * Synchronization strategy:
 * - All timing is in TRACK TIME space (ms from track start)
 * - Viruses are spawned AHEAD of time so they arrive at the hit line
 *   exactly when the corresponding beat sounds
 * - Beat pulse detection uses binary search for O(log n) performance
 * - Look-ahead window ensures smooth spawning even with frame jitter
 *
 * The key insight: a virus for beat at time T must be spawned at
 * time (T - travelDuration), so that it visually arrives at T.
 */

const RHYTHM_TRAVEL_MS = 2200;

// How far ahead (in track time) we look for upcoming beats to spawn
const LOOKAHEAD_MS = RHYTHM_TRAVEL_MS + 200; // extra buffer for frame timing

// How far in the past a beat can be and still get spawned (for late frames)
const LATE_TOLERANCE_MS = 100;

// Beat pulse detection window (±ms around beat time)
const PULSE_WINDOW_MS = 40;

// Max distance (in track time ms) from arrival for a keypress to match a virus.
// Prevents matching viruses that are still high on the screen.
// Should match the BAD hit window from constants (300ms) + small buffer.
const MAX_HIT_WINDOW_MS = 350;

export class RhythmSpawner {
    constructor(spawnSystem) {
        this._spawner = spawnSystem;
        this._beats = [];
        this._nextBeatIdx = 0;
        this._activeKeys = ['f', 'j'];

        // Beat pulse tracking
        this._nextPulseIdx = 0;
        this._beatJustHit = false;
        this._lastPulseTime = -Infinity;

        // Spawned beat tracking — prevents double-spawning
        this._spawnedBeats = new Set();

        // Key distribution — avoid same key repeatedly
        this._lastKey = '';
        this._keyRepeatCount = 0;
    }

    setBeatMap(beatMap) {
        this._beats = beatMap.beats;
        this._nextBeatIdx = 0;
        this._nextPulseIdx = 0;
        this._spawnedBeats.clear();
    }

    setActiveKeys(keys) {
        this._activeKeys = keys;
    }

    /**
     * Main update — call every frame with current track time.
     * Handles both virus spawning and beat pulse detection.
     *
     * @param {number} trackTimeMs — current playback position (ms)
     */
    update(trackTimeMs) {
        this._beatJustHit = false;

        this._spawnUpcomingViruses(trackTimeMs);
        this._detectBeatPulse(trackTimeMs);
    }

    /**
     * Spawn viruses for beats that should arrive within the look-ahead window.
     * A beat at time T requires spawning when trackTime >= T - travelDuration.
     */
    _spawnUpcomingViruses(trackTimeMs) {
        // The earliest arrival time we care about
        const minArrival = trackTimeMs - LATE_TOLERANCE_MS;
        // The latest arrival time we'll pre-spawn for
        const maxArrival = trackTimeMs + LOOKAHEAD_MS;

        while (this._nextBeatIdx < this._beats.length) {
            const beatTime = this._beats[this._nextBeatIdx];

            // Skip beats that are too far in the past
            if (beatTime < minArrival) {
                this._nextBeatIdx++;
                continue;
            }

            // Stop if beat is beyond our look-ahead
            if (beatTime > maxArrival) break;

            // Check if we already spawned this beat
            if (this._spawnedBeats.has(this._nextBeatIdx)) {
                this._nextBeatIdx++;
                continue;
            }

            // Ideal spawn time for this beat
            const idealSpawnTime = beatTime - RHYTHM_TRAVEL_MS;

            // Only spawn if we're at or past the ideal spawn time
            // (with some tolerance for frame timing)
            if (trackTimeMs >= idealSpawnTime - 50) {
                const key = this._pickKey();

                this._spawner.spawnRhythmVirus(key, idealSpawnTime, RHYTHM_TRAVEL_MS);
                this._spawnedBeats.add(this._nextBeatIdx);
                this._nextBeatIdx++;
            } else {
                // Not yet time to spawn this beat
                break;
            }
        }
    }

    /**
     * Pick a key with better distribution — avoid 3+ same key in a row.
     */
    _pickKey() {
        if (this._activeKeys.length <= 1) {
            return this._activeKeys[0] || 'f';
        }

        let key;
        if (this._keyRepeatCount >= 2) {
            // Force a different key
            const filtered = this._activeKeys.filter(k => k !== this._lastKey);
            key = randomItem(filtered.length > 0 ? filtered : this._activeKeys);
        } else {
            key = randomItem(this._activeKeys);
        }

        if (key === this._lastKey) {
            this._keyRepeatCount++;
        } else {
            this._keyRepeatCount = 0;
            this._lastKey = key;
        }

        return key;
    }

    /**
     * Detect if a beat is happening right now (for visual/audio pulse effects).
     * Uses the pulse index to avoid re-scanning the whole array.
     */
    _detectBeatPulse(trackTimeMs) {
        // Advance pulse index to current time region
        while (
            this._nextPulseIdx < this._beats.length &&
            this._beats[this._nextPulseIdx] < trackTimeMs - PULSE_WINDOW_MS
        ) {
            this._nextPulseIdx++;
        }

        // Check if current beat is within pulse window
        if (this._nextPulseIdx < this._beats.length) {
            const bt = this._beats[this._nextPulseIdx];
            if (
                bt >= trackTimeMs - PULSE_WINDOW_MS &&
                bt <= trackTimeMs + PULSE_WINDOW_MS &&
                bt !== this._lastPulseTime
            ) {
                this._beatJustHit = true;
                this._lastPulseTime = bt;
            }
        }
    }

    /** True if a beat just occurred this frame */
    get beatPulse() {
        return this._beatJustHit;
    }

    /**
     * Update all rhythm viruses using track time.
     * Handles position interpolation, miss detection, and cleanup.
     */
    updateViruses(trackTimeMs) {
        const viruses = this._spawner.activeViruses;

        for (let i = viruses.length - 1; i >= 0; i--) {
            const v = viruses[i];
            if (!v.alive) continue;

            // Calculate progress based on track time
            const elapsed = trackTimeMs - v.spawnTime;
            v.progress = elapsed / v.travelDuration;

            // Smooth position interpolation
            const t = Math.min(v.progress, 1);
            v.y = v.startY + (v.targetY - v.startY) * t;

            // Scale: subtle grow as it approaches
            v.scale = 0.8 + 0.3 * t;

            // Miss detection: past the hit line by a comfortable margin
            // Use 15% overshoot to give players a fair window
            if (v.progress >= 1.15 && !v.hit) {
                v.alive = false;
                this._spawner._bus.emit('virus:missed', { virus: v });
            }

            // Hit fade-out animation
            if (v.hit) {
                v.opacity -= 0.08;
                if (v.opacity <= 0) v.alive = false;
            }

            // Cleanup dead viruses
            if (!v.alive) {
                viruses.splice(i, 1);
                this._spawner._pool.release(v);
            }
        }
    }

    /**
     * Find the best matching virus for a key press.
     * ONLY matches viruses that are within the hit window (±MAX_HIT_WINDOW_MS)
     * of their arrival at the hit line. Viruses still high on screen
     * are NOT matched — pressing their key early just triggers a bad sound.
     *
     * @param {string} key — pressed key
     * @param {number} trackTimeMs — current track position
     * @returns {Virus|null}
     */
    findMatchingVirus(key, trackTimeMs) {
        let best = null;
        let bestDiff = Infinity;

        for (const v of this._spawner.activeViruses) {
            if (!v.alive || v.hit || v.key !== key) continue;

            const arrivalTime = v.spawnTime + v.travelDuration;
            const diff = Math.abs(arrivalTime - trackTimeMs);

            // Only match if the virus is near the hit line (within hit window)
            // This prevents accidentally destroying viruses that are still high up
            if (diff > MAX_HIT_WINDOW_MS) continue;

            if (diff < bestDiff) {
                bestDiff = diff;
                best = v;
            }
        }

        return best;
    }

    reset() {
        this._nextBeatIdx = 0;
        this._nextPulseIdx = 0;
        this._lastPulseTime = -Infinity;
        this._beatJustHit = false;
        this._spawnedBeats.clear();
        this._lastKey = '';
        this._keyRepeatCount = 0;
    }

    get isComplete() {
        return this._nextBeatIdx >= this._beats.length;
    }

    get travelDuration() {
        return RHYTHM_TRAVEL_MS;
    }
}
