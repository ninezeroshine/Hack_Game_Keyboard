import { loadSettings, saveSettings, loadBestScore } from '../utils/storage.js';

/**
 * Screen manager — handles show/hide of all overlay screens and their button interactions.
 */
export class ScreenManager {
    constructor(eventBus) {
        this._bus = eventBus;
        this._screens = {
            menu: document.getElementById('screen-menu'),
            pause: document.getElementById('screen-pause'),
            gameover: document.getElementById('screen-gameover'),
            settings: document.getElementById('screen-settings'),
            tutorial: document.getElementById('screen-tutorial'),
            countdown: document.getElementById('countdown-overlay'),
            rhythmUpload: document.getElementById('screen-rhythm-upload'),
            analyzing: document.getElementById('screen-analyzing'),
        };
        this._settings = loadSettings();
        this._previousScreen = null;
        this._bindButtons();
        this._bindSettings();
        this._bindRhythmUpload();
    }

    _bindButtons() {
        // Menu buttons
        document.getElementById('btn-sprint')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'start-sprint' });
        });
        document.getElementById('btn-endless')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'start-endless' });
        });
        document.getElementById('btn-training')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'start-training' });
        });
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this._previousScreen = 'menu';
            this.showScreen('settings');
        });

        // Rhythm mode
        document.getElementById('btn-rhythm')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'start-rhythm' });
        });

        // Pause
        document.getElementById('btn-resume')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'resume' });
        });
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'restart' });
        });
        document.getElementById('btn-quit')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'quit' });
        });

        // Game Over
        document.getElementById('btn-retry')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'restart' });
        });
        document.getElementById('btn-menu')?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'quit' });
        });

        // Settings back
        document.getElementById('btn-settings-back')?.addEventListener('click', () => {
            saveSettings(this._settings);
            this._bus.emit('settings:changed', this._settings);
            this.showScreen(this._previousScreen || 'menu');
        });
    }

    _bindSettings() {
        const layoutEl = document.getElementById('setting-layout');
        const diffEl = document.getElementById('setting-difficulty');
        const volEl = document.getElementById('setting-volume');
        const contrastEl = document.getElementById('setting-contrast');
        const glitchEl = document.getElementById('setting-glitch');
        const fontEl = document.getElementById('setting-fontsize');

        // Init from saved
        if (layoutEl) layoutEl.value = this._settings.layout || 'en';
        if (diffEl) diffEl.value = this._settings.difficulty;
        if (volEl) volEl.value = this._settings.volume;
        if (contrastEl) {
            contrastEl.dataset.state = this._settings.highContrast ? 'on' : 'off';
            contrastEl.textContent = this._settings.highContrast ? 'ON' : 'OFF';
        }
        if (glitchEl) {
            glitchEl.dataset.state = this._settings.glitchEffects ? 'on' : 'off';
            glitchEl.textContent = this._settings.glitchEffects ? 'ON' : 'OFF';
        }
        if (fontEl) fontEl.value = this._settings.fontSize;

        // Listeners
        layoutEl?.addEventListener('change', (e) => {
            this._settings.layout = e.target.value;
        });
        diffEl?.addEventListener('change', (e) => {
            this._settings.difficulty = e.target.value;
        });
        volEl?.addEventListener('input', (e) => {
            this._settings.volume = parseInt(e.target.value);
        });
        contrastEl?.addEventListener('click', () => {
            this._settings.highContrast = !this._settings.highContrast;
            contrastEl.dataset.state = this._settings.highContrast ? 'on' : 'off';
            contrastEl.textContent = this._settings.highContrast ? 'ON' : 'OFF';
        });
        glitchEl?.addEventListener('click', () => {
            this._settings.glitchEffects = !this._settings.glitchEffects;
            glitchEl.dataset.state = this._settings.glitchEffects ? 'on' : 'off';
            glitchEl.textContent = this._settings.glitchEffects ? 'ON' : 'OFF';
        });
        fontEl?.addEventListener('change', (e) => {
            this._settings.fontSize = e.target.value;
        });
    }

    _bindRhythmUpload() {
        const dropzone = document.getElementById('rhythm-dropzone');
        const fileInput = document.getElementById('rhythm-file-input');
        const browseBtn = document.getElementById('btn-rhythm-browse');
        const startBtn = document.getElementById('btn-rhythm-start');
        const backBtn = document.getElementById('btn-rhythm-back');
        const trackInfo = document.getElementById('rhythm-track-info');
        const trackName = document.getElementById('rhythm-track-name');

        // Drag and drop
        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-active');
        });
        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-active');
        });
        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-active');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                this._onRhythmFileSelected(file);
            }
        });

        // Click dropzone = browse
        dropzone?.addEventListener('click', () => fileInput?.click());
        browseBtn?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this._onRhythmFileSelected(file);
        });

        // Start button
        startBtn?.addEventListener('click', () => {
            this._bus.emit('screen:action', { action: 'rhythm-start-game' });
        });

        // Back button
        backBtn?.addEventListener('click', () => {
            this.showScreen('menu');
        });
    }

    _onRhythmFileSelected(file) {
        const trackName = document.getElementById('rhythm-track-name');
        const trackInfo = document.getElementById('rhythm-track-info');

        if (trackName) trackName.textContent = `\u266a ${file.name}`;
        trackInfo?.classList.remove('hidden');

        this._bus.emit('rhythm:fileSelected', { file });
    }

    /** Update analyzing progress bar (0–1) */
    updateAnalyzingProgress(progress, status) {
        const bar = document.getElementById('analyzing-bar');
        const statusEl = document.getElementById('analyzing-status');
        if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
        if (statusEl && status) statusEl.textContent = status;
    }

    /** Get current rhythm sensitivity slider value (1–10) */
    get rhythmSensitivity() {
        const el = document.getElementById('rhythm-sensitivity');
        return el ? parseInt(el.value, 10) : 3;
    }

    showScreen(name) {
        for (const [key, el] of Object.entries(this._screens)) {
            el.classList.toggle('hidden', key !== name);
        }
    }

    hideAll() {
        for (const el of Object.values(this._screens)) {
            el.classList.add('hidden');
        }
    }

    updateGameOver(stats) {
        document.getElementById('go-score').textContent = stats.score.toLocaleString();
        document.getElementById('go-combo').textContent = stats.maxCombo;
        document.getElementById('go-accuracy').textContent = Math.round(stats.accuracy * 100) + '%';
        document.getElementById('go-perfect').textContent = stats.perfects;
        document.getElementById('go-good').textContent = stats.goods;
        document.getElementById('go-bad').textContent = stats.bads;
        document.getElementById('go-miss').textContent = stats.misses;
        document.getElementById('gameover-rank').textContent = stats.rank;
    }

    updateBestScore() {
        const best = Math.max(loadBestScore('SPRINT'), loadBestScore('ENDLESS'));
        document.getElementById('menu-best-score').textContent = best.toLocaleString();
    }

    showCountdown(text) {
        this._screens.countdown.classList.remove('hidden');
        document.getElementById('countdown-text').textContent = text;
    }

    hideCountdown() {
        this._screens.countdown.classList.add('hidden');
    }

    get settings() {
        return this._settings;
    }
}
