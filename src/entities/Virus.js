import { VIRUS } from '../config/constants.js';

/**
 * Virus entity — a character falling from top toward its key lane.
 * Managed by ObjectPool: created once, reused via init().
 */
export class Virus {
    constructor() {
        this.key = '';              // keyboard character to type
        this.lane = 0;              // lane index (maps to key column x)
        this.x = 0;                 // horizontal center of lane
        this.y = 0;                 // current vertical position
        this.startY = 0;            // spawn y (above viewport)
        this.targetY = 0;           // hit line y (keyboard top)
        this.spawnTime = 0;         // when spawned (game elapsed ms)
        this.arrivalTime = 0;       // when it reaches the hit line
        this.travelDuration = VIRUS.TRAVEL_TIME_BASE;
        this.progress = 0;          // 0 → 1 (top to hit line)
        this.alive = false;
        this.hit = false;
        this.hitGrade = '';
        this.opacity = 1;
        this.scale = 1;
    }

    init(key, lane, x, startY, targetY, spawnTime, travelDuration) {
        this.key = key;
        this.lane = lane;
        this.x = x;
        this.y = startY;
        this.startY = startY;
        this.targetY = targetY;
        this.spawnTime = spawnTime;
        this.travelDuration = travelDuration;
        this.arrivalTime = spawnTime + travelDuration;
        this.progress = 0;
        this.alive = true;
        this.hit = false;
        this.hitGrade = '';
        this.opacity = 1;
        this.scale = 1;
    }

    update(elapsed) {
        if (!this.alive) return;

        this.progress = (elapsed - this.spawnTime) / this.travelDuration;

        if (this.progress >= 1 && !this.hit) {
            this.progress = 1;
        }

        // Vertical fall — simple linear interpolation
        this.y = this.startY + (this.targetY - this.startY) * Math.min(this.progress, 1);

        // Slight scale increase as it approaches the hit line
        this.scale = 0.8 + 0.3 * Math.min(this.progress, 1);
    }

    /** Time until arrival (negative = past due) */
    timeToArrival(elapsed) {
        return this.arrivalTime - elapsed;
    }

    reset() {
        this.alive = false;
        this.hit = false;
        this.hitGrade = '';
        this.progress = 0;
        this.opacity = 1;
        this.scale = 1;
    }
}
