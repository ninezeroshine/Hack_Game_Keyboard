import { STRINGS } from '../config/strings.js';

/**
 * HUD controller — updates DOM elements for Score, Combo, HP, BPM, hit feedback.
 */
export class HUD {
    constructor() {
        this._els = {
            hud: document.getElementById('hud'),
            score: document.getElementById('hud-score'),
            combo: document.getElementById('hud-combo'),
            multiplier: document.getElementById('hud-multiplier'),
            bpm: document.getElementById('hud-bpm-value'),
            hitFeedback: document.getElementById('hud-hit-feedback'),
            hpSegments: document.querySelectorAll('.hp-segment'),
        };
        this._feedbackTimer = null;
    }

    show() { this._els.hud.classList.remove('hidden'); }
    hide() { this._els.hud.classList.add('hidden'); }

    updateScore(score) {
        this._els.score.textContent = score.toLocaleString();
    }

    updateCombo(combo, multiplier) {
        this._els.combo.textContent = combo;
        this._els.multiplier.textContent = `x${multiplier.toFixed(1)}`;
    }

    updateBPM(bpm) {
        this._els.bpm.textContent = Math.round(bpm);
    }

    updateHP(segments, max) {
        const els = this._els.hpSegments;
        for (let i = 0; i < els.length; i++) {
            els[i].classList.remove('active', 'warning');
            if (i < segments) {
                els[i].classList.add(segments <= 2 ? 'warning' : 'active');
            }
        }
    }

    showHitFeedback(grade) {
        const el = this._els.hitFeedback;
        const texts = {
            perfect: STRINGS.HIT_PERFECT,
            good: STRINGS.HIT_GOOD,
            bad: STRINGS.HIT_BAD,
            miss: STRINGS.HIT_MISS,
        };

        el.textContent = texts[grade] || grade;
        el.className = 'hit-feedback show ' + grade;

        clearTimeout(this._feedbackTimer);
        this._feedbackTimer = setTimeout(() => {
            el.className = 'hit-feedback';
        }, 500);
    }
}
