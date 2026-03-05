import { getKeyboardRows } from '../config/keyLevels.js';

/**
 * Visual keyboard display — the "wall" at the bottom of the screen.
 * Exposes key center positions for the lane-based spawn system.
 */
export class KeyboardDisplay {
    constructor() {
        this._container = document.getElementById('keyboard-display');
        this._keyEls = new Map();
        this._activeKeys = new Set();
        this._layout = 'en';
        this._keyPositions = new Map();  // key → center X
        this._hitLineY = 0;              // top of keyboard container
        this._build();
    }

    _build() {
        this._container.innerHTML = '';
        this._keyEls.clear();
        const rows = getKeyboardRows(this._layout);

        for (const row of rows) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'kb-row';
            for (const key of row) {
                const keyDiv = document.createElement('div');
                keyDiv.className = 'kb-key';
                keyDiv.textContent = key.toUpperCase();
                keyDiv.dataset.key = key;
                this._keyEls.set(key, keyDiv);
                rowDiv.appendChild(keyDiv);
            }
            this._container.appendChild(rowDiv);
        }

        // Re-apply active keys after rebuild
        for (const [key, el] of this._keyEls) {
            el.classList.toggle('active', this._activeKeys.has(key));
        }
    }

    /**
     * Compute lane X positions from the rendered DOM.
     * Must be called after the keyboard is visible and laid out.
     */
    computeLanePositions() {
        this._keyPositions.clear();
        for (const [key, el] of this._keyEls) {
            const rect = el.getBoundingClientRect();
            this._keyPositions.set(key, rect.left + rect.width / 2);
        }
        // Hit line = top of the keyboard container
        const containerRect = this._container.getBoundingClientRect();
        this._hitLineY = containerRect.top;
    }

    /** Get map of key → center X for lanes */
    get keyPositions() {
        return this._keyPositions;
    }

    /** Get Y position of the hit line (top of keyboard) */
    get hitLineY() {
        return this._hitLineY;
    }

    setLayout(layout) {
        if (this._layout === layout) return;
        this._layout = layout;
        this._build();
    }

    show() {
        this._container.classList.remove('hidden');
        // Need a frame for DOM to layout before computing positions
        requestAnimationFrame(() => this.computeLanePositions());
    }

    hide() { this._container.classList.add('hidden'); }

    setActiveKeys(keys) {
        this._activeKeys = new Set(keys);
        for (const [key, el] of this._keyEls) {
            el.classList.toggle('active', this._activeKeys.has(key));
        }
    }

    pressKey(key) {
        const el = this._keyEls.get(key);
        if (!el) return;
        el.classList.add('pressed');
        setTimeout(() => el.classList.remove('pressed'), 120);
    }

    unlockKeys(newKeys) {
        for (const key of newKeys) {
            const el = this._keyEls.get(key);
            if (!el) continue;
            el.classList.add('active', 'new-unlock');
            setTimeout(() => el.classList.remove('new-unlock'), 700);
        }
        for (const key of newKeys) {
            this._activeKeys.add(key);
        }
        // Recompute positions after unlock changes layout
        requestAnimationFrame(() => this.computeLanePositions());
    }
}
