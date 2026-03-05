import { VIRUS } from '../config/constants.js';
import { Virus } from '../entities/Virus.js';
import { ObjectPool } from '../entities/ObjectPool.js';
import { randomItem } from '../utils/math.js';

/**
 * Spawn system — lane-based. Each active key has a lane (column).
 * Viruses spawn at top and fall toward the keyboard hit line.
 */
export class SpawnSystem {
    constructor(eventBus) {
        this._bus = eventBus;
        this._pool = new ObjectPool(
            () => new Virus(),
            (v) => v.reset(),
            30
        );
        this.activeViruses = [];
        this._activeKeys = ['f', 'j'];
        this._laneMap = new Map();    // key → { index, x }
        this._hitLineY = 0;
        this._spawnY = -50;           // above viewport
        this._spawnRate = 1;
        this._beatAccum = 0;
        this._travelDuration = VIRUS.TRAVEL_TIME_BASE;
    }

    setActiveKeys(keys) {
        this._activeKeys = keys;
    }

    /**
     * Build lane positions from keyboard display positions.
     * @param {Map<string, number>} keyPositions — key → center X coordinate
     * @param {number} hitLineY — Y position of the hit line (top of keyboard)
     */
    setLaneLayout(keyPositions, hitLineY) {
        this._laneMap = keyPositions;
        this._hitLineY = hitLineY;
        this._spawnY = -50;
    }

    setSpawnRate(rate) {
        this._spawnRate = rate;
    }

    setTravelDuration(duration) {
        this._travelDuration = Math.max(VIRUS.TRAVEL_TIME_MIN, duration);
    }

    onBeat(elapsed) {
        this._beatAccum += this._spawnRate;
        while (this._beatAccum >= 1) {
            this._beatAccum -= 1;
            this._spawnVirus(elapsed);
        }
    }

    _spawnVirus(elapsed) {
        const key = randomItem(this._activeKeys);
        const laneX = this._laneMap.get(key);

        // If key has no lane position yet, skip
        if (laneX === undefined) return;

        const virus = this._pool.acquire();
        const laneIndex = this._activeKeys.indexOf(key);

        virus.init(
            key,
            laneIndex,
            laneX,
            this._spawnY,
            this._hitLineY,
            elapsed,
            this._travelDuration
        );

        this.activeViruses.push(virus);
        this._bus.emit('virus:spawned', { key, virus });
    }

    /**
     * Spawn a virus for rhythm mode with explicit timing.
     * Called by RhythmSpawner with pre-calculated beat times.
     */
    spawnRhythmVirus(key, spawnTime, travelDuration) {
        const laneX = this._laneMap.get(key);
        if (laneX === undefined) return;

        const virus = this._pool.acquire();
        const laneIndex = this._activeKeys.indexOf(key);

        virus.init(
            key,
            laneIndex,
            laneX,
            this._spawnY,
            this._hitLineY,
            spawnTime,
            travelDuration
        );

        this.activeViruses.push(virus);
        this._bus.emit('virus:spawned', { key, virus });
    }

    update(elapsed) {
        for (let i = this.activeViruses.length - 1; i >= 0; i--) {
            const v = this.activeViruses[i];
            v.update(elapsed);

            // Virus passed the hit line without being hit
            if (v.progress >= 1 && !v.hit) {
                v.alive = false;
                this._bus.emit('virus:missed', { virus: v });
            }

            // Hit fade-out
            if (v.hit) {
                v.opacity -= 0.08;
                if (v.opacity <= 0) v.alive = false;
            }

            if (!v.alive) {
                this.activeViruses.splice(i, 1);
                this._pool.release(v);
            }
        }
    }

    /**
     * Find the best virus matching a key press.
     * Prioritizes the one closest to the hit line (most urgent).
     */
    findMatchingVirus(key, elapsed) {
        let best = null;
        let bestDistance = Infinity;

        for (const v of this.activeViruses) {
            if (!v.alive || v.hit) continue;
            if (v.key !== key) continue;

            const timeDiff = Math.abs(v.arrivalTime - elapsed);
            if (timeDiff < bestDistance) {
                bestDistance = timeDiff;
                best = v;
            }
        }

        return best;
    }

    reset() {
        for (const v of this.activeViruses) {
            this._pool.release(v);
        }
        this.activeViruses = [];
        this._beatAccum = 0;
    }
}
