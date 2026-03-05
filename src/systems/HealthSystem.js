import { HEALTH } from '../config/constants.js';
import { clamp } from '../utils/math.js';

/**
 * Health system — tracks system integrity (HP segments).
 */
export class HealthSystem {
    constructor(eventBus) {
        this._bus = eventBus;
        this.segments = HEALTH.MAX_SEGMENTS;
        this.maxSegments = HEALTH.MAX_SEGMENTS;
        this.isInvulnerable = false;  // for training mode
    }

    takeDamage(amount = HEALTH.MISS_DAMAGE) {
        if (this.isInvulnerable) return;

        this.segments = clamp(this.segments - amount, 0, this.maxSegments);
        this._bus.emit('health:changed', { segments: this.segments, max: this.maxSegments });

        if (this.segments <= 0) {
            this._bus.emit('health:dead', {});
        }
    }

    get isAlive() {
        return this.segments > 0;
    }

    get isLow() {
        return this.segments <= 2;
    }

    reset() {
        this.segments = this.maxSegments;
        this._bus.emit('health:changed', { segments: this.segments, max: this.maxSegments });
    }
}
