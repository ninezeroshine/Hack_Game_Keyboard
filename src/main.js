import { Game } from './core/Game.js';

/**
 * Application entry point.
 * Waits for DOM to be ready, then initializes the game.
 */
function init() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    const game = new Game(canvas);

    // Handle tab visibility — pause when hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.state === 'PLAYING') {
            game._onPauseToggle();
        }
    });

    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
