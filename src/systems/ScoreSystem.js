import { HIT_WINDOWS, SCORING } from '../config/constants.js';
import { clamp } from '../utils/math.js';

/**
 * Score system — evaluates hit timing, tracks combo, computes multipliers.
 */
export class ScoreSystem {
    constructor(eventBus) {
        this._bus = eventBus;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.totalHits = 0;
        this.perfects = 0;
        this.goods = 0;
        this.bads = 0;
        this.misses = 0;
        this._badStreak = 0;
    }

    /**
     * Evaluate a hit and return grade.
     * @param {number} timeDiff — absolute ms difference from perfect timing
     */
    evaluateHit(timeDiff) {
        if (timeDiff <= HIT_WINDOWS.PERFECT) return 'perfect';
        if (timeDiff <= HIT_WINDOWS.GOOD) return 'good';
        if (timeDiff <= HIT_WINDOWS.BAD) return 'bad';
        return 'miss';
    }

    registerHit(grade) {
        this.totalHits++;

        switch (grade) {
            case 'perfect':
                this.perfects++;
                this.combo++;
                this._badStreak = 0;
                this._updateMultiplier();
                this.score += Math.round(SCORING.BASE_POINTS * SCORING.PERFECT_MULT * this.multiplier);
                break;
            case 'good':
                this.goods++;
                this.combo++;
                this._badStreak = 0;
                this._updateMultiplier();
                this.score += Math.round(SCORING.BASE_POINTS * SCORING.GOOD_MULT * this.multiplier);
                break;
            case 'bad':
                this.bads++;
                this._badStreak++;
                this.combo = 0;
                this._updateMultiplier();
                this.score += Math.round(SCORING.BASE_POINTS * SCORING.BAD_MULT);
                break;
            case 'miss':
                this.misses++;
                this._badStreak++;
                this.combo = 0;
                this._updateMultiplier();
                break;
        }

        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this._bus.emit('score:updated', this.getStats());
        return grade;
    }

    registerMiss() {
        return this.registerHit('miss');
    }

    get badStreak() {
        return this._badStreak;
    }

    _updateMultiplier() {
        this.multiplier = clamp(
            1 + this.combo * SCORING.COMBO_BONUS,
            1,
            SCORING.MAX_COMBO_MULT
        );
    }

    get accuracy() {
        if (this.totalHits === 0) return 1;
        return (this.perfects + this.goods) / this.totalHits;
    }

    getStats() {
        return {
            score: this.score,
            combo: this.combo,
            maxCombo: this.maxCombo,
            multiplier: this.multiplier,
            accuracy: this.accuracy,
            perfects: this.perfects,
            goods: this.goods,
            bads: this.bads,
            misses: this.misses,
        };
    }

    getRank() {
        const acc = this.accuracy;
        if (acc >= 0.95 && this.maxCombo >= 50) return 'S';
        if (acc >= 0.80 && this.maxCombo >= 30) return 'A';
        if (acc >= 0.60 && this.maxCombo >= 15) return 'B';
        return 'C';
    }

    reset() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.totalHits = 0;
        this.perfects = 0;
        this.goods = 0;
        this.bads = 0;
        this.misses = 0;
        this._badStreak = 0;
    }
}
