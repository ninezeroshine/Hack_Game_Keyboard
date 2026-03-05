/**
 * Input system — captures keyboard events and maps them to game actions.
 * Abstracted so keys can be rebound without touching game logic.
 */
export class InputSystem {
    constructor(eventBus) {
        this._bus = eventBus;
        this._enabled = false;
        this._onKeyDown = this._handleKeyDown.bind(this);
    }

    enable() {
        if (this._enabled) return;
        this._enabled = true;
        window.addEventListener('keydown', this._onKeyDown);
    }

    disable() {
        this._enabled = false;
        window.removeEventListener('keydown', this._onKeyDown);
    }

    _handleKeyDown(e) {
        // Ignore repeats (held keys)
        if (e.repeat) return;

        const key = e.key.toLowerCase();

        // Meta keys — handled separately
        if (key === 'escape' || key === 'p') {
            this._bus.emit('input:pause', {});
            e.preventDefault();
            return;
        }

        // Game key press
        this._bus.emit('input:key', { key, timestamp: performance.now() });
        e.preventDefault();
    }

    destroy() {
        this.disable();
    }
}
