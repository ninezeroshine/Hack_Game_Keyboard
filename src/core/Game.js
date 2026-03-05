import { GAME, GAME_STATES, GAME_MODES, HEALTH, HIT_WINDOWS, BPM as BPM_CONST, VIRUS } from '../config/constants.js';
import { STRINGS } from '../config/strings.js';
import { Clock } from './Clock.js';
import { EventBus } from './EventBus.js';
import { InputSystem } from '../systems/InputSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { ScoreSystem } from '../systems/ScoreSystem.js';
import { HealthSystem } from '../systems/HealthSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';
import { RhythmSpawner } from '../systems/RhythmSpawner.js';
import { Renderer } from '../rendering/Renderer.js';
import { EffectsLayer } from '../rendering/EffectsLayer.js';
import { Particles } from '../rendering/Particles.js';
import { AudioManager } from '../audio/AudioManager.js';
import { BeatDetector } from '../audio/BeatDetector.js';
import { TrackLoader } from '../audio/TrackLoader.js';
import { HUD } from '../ui/HUD.js';
import { KeyboardDisplay } from '../ui/KeyboardDisplay.js';
import { ScreenManager } from '../ui/ScreenManager.js';
import { saveBestScore } from '../utils/storage.js';

/**
 * Main Game class — orchestrates all systems, manages state machine,
 * runs the game loop.
 *
 * Supports standard modes (Sprint/Endless/Training) and Rhythm mode
 * where viruses spawn in sync with user-uploaded music.
 */
export class Game {
    constructor(canvas) {
        // Core
        this.bus = new EventBus();
        this.clock = new Clock();
        this.state = GAME_STATES.MENU;
        this.mode = GAME_MODES.SPRINT;

        // Systems
        this.input = new InputSystem(this.bus);
        this.spawner = new SpawnSystem(this.bus);
        this.score = new ScoreSystem(this.bus);
        this.health = new HealthSystem(this.bus);
        this.difficulty = new DifficultySystem(this.bus);

        // Rhythm mode
        this.beatDetector = new BeatDetector();
        this.trackLoader = null;       // created on first use (needs AudioContext)
        this.rhythmSpawner = null;     // created when starting rhythm mode
        this._beatMap = null;          // current beat map from analysis
        this._rhythmFile = null;       // pending audio file

        // Rendering
        this.renderer = new Renderer(canvas);
        this.effects = new EffectsLayer();
        this.particles = new Particles();

        // Audio
        this.audio = new AudioManager();

        // UI
        this.hud = new HUD();
        this.keyboard = new KeyboardDisplay();
        this.screens = new ScreenManager(this.bus);

        // Internal
        this._rafId = null;
        this._countdownStep = 0;
        this._countdownTimer = 0;
        this._laneLayoutReady = false;

        this._bindEvents();
        this._applySettings(this.screens.settings);
        this.screens.updateBestScore();
    }

    _bindEvents() {
        // Input
        this.bus.on('input:key', (data) => this._onKeyPress(data));
        this.bus.on('input:pause', () => this._onPauseToggle());

        // Screen actions
        this.bus.on('screen:action', ({ action }) => this._onScreenAction(action));

        // Health
        this.bus.on('health:dead', () => this._gameOver());
        this.bus.on('health:changed', ({ segments, max }) => this.hud.updateHP(segments, max));

        // Score
        this.bus.on('score:updated', (stats) => {
            this.hud.updateScore(stats.score);
            this.hud.updateCombo(stats.combo, stats.multiplier);
            if (this.mode === GAME_MODES.ENDLESS) {
                this.difficulty.maybeUnlockKeys(stats.score);
            }
        });

        // Virus missed
        this.bus.on('virus:missed', ({ virus }) => {
            this.score.registerMiss();
            this.health.takeDamage(HEALTH.MISS_DAMAGE);
            this.effects.triggerShake(4, 150);
            this.audio.playBuzz();
            this.hud.showHitFeedback('miss');
        });

        // Difficulty new keys
        this.bus.on('difficulty:newKeys', ({ keys, level }) => {
            this.keyboard.unlockKeys(keys);
            this.spawner.setActiveKeys(this.difficulty.activeKeys);
            this._updateLaneLayout();
        });

        // Rhythm file selected
        this.bus.on('rhythm:fileSelected', ({ file }) => {
            this._rhythmFile = file;
        });

        // Settings
        this.bus.on('settings:changed', (settings) => this._applySettings(settings));
    }

    _applySettings(settings) {
        document.body.classList.toggle('high-contrast', settings.highContrast);
        document.body.classList.toggle('no-glitch', !settings.glitchEffects);
        document.body.classList.remove('font-small', 'font-large');
        if (settings.fontSize === 'small') document.body.classList.add('font-small');
        if (settings.fontSize === 'large') document.body.classList.add('font-large');
        this.effects.enabled = settings.glitchEffects;
        this.audio.setVolume(settings.volume);
    }

    _updateLaneLayout() {
        this.keyboard.computeLanePositions();
        this.spawner.setLaneLayout(this.keyboard.keyPositions, this.keyboard.hitLineY);
        this._laneLayoutReady = this.keyboard.keyPositions.size > 0;
    }

    // ═══════════════════════════════════
    //  STATE TRANSITIONS
    // ═══════════════════════════════════

    _onScreenAction(action) {
        this.audio.init();

        switch (action) {
            case 'start-sprint':
                this.mode = GAME_MODES.SPRINT;
                this._startCountdown();
                break;
            case 'start-endless':
                this.mode = GAME_MODES.ENDLESS;
                this._startCountdown();
                break;
            case 'start-training':
                this.mode = GAME_MODES.TRAINING;
                this._startCountdown();
                break;
            case 'start-rhythm':
                this._showRhythmUpload();
                break;
            case 'rhythm-start-game':
                this._startRhythmAnalysis();
                break;
            case 'resume':
                this._resume();
                break;
            case 'restart':
                this._startCountdown();
                break;
            case 'quit':
                this._toMenu();
                break;
        }
    }

    _showRhythmUpload() {
        this.screens.showScreen('rhythmUpload');
    }

    /** Analyze the loaded audio file, then start rhythm gameplay */
    async _startRhythmAnalysis() {
        if (!this._rhythmFile) return;

        this.mode = GAME_MODES.RHYTHM;
        this.state = GAME_STATES.ANALYZING;
        this.screens.showScreen('analyzing');
        this.screens.updateAnalyzingProgress(0, 'Decoding audio...');

        // Ensure AudioContext exists
        this.audio.init();

        // Create TrackLoader if needed
        if (!this.trackLoader) {
            this.trackLoader = new TrackLoader(this.audio._ctx);
        }

        try {
            // Decode audio
            this.screens.updateAnalyzingProgress(0.1, 'Decoding audio...');
            const audioBuffer = await this.trackLoader.loadFile(this._rhythmFile);

            // Analyze beats with user-selected sensitivity
            const sensitivity = this.screens.rhythmSensitivity;
            this.screens.updateAnalyzingProgress(0.2, 'Analyzing beats...');
            this._beatMap = await this.beatDetector.analyze(audioBuffer, sensitivity, (p) => {
                const overall = 0.2 + p * 0.7;
                this.screens.updateAnalyzingProgress(overall, `Detecting beats... ${Math.round(p * 100)}%`);
            });

            this.screens.updateAnalyzingProgress(1.0, `Found ${this._beatMap.totalBeats} beats @ ${this._beatMap.bpm} BPM`);

            // Brief pause to show results
            await new Promise((r) => setTimeout(r, 800));

            // Start countdown → game
            this._startCountdown();
        } catch (err) {
            console.error('Beat analysis failed:', err);
            this.screens.updateAnalyzingProgress(0, 'Error: Could not analyze file.');
        }
    }

    _startCountdown() {
        this.state = GAME_STATES.COUNTDOWN;
        this.screens.hideAll();
        this.hud.hide();
        this.keyboard.hide();
        this._countdownStep = 0;
        this._countdownTimer = 0;
        this._resetGame();

        this.screens.showCountdown(STRINGS.COUNTDOWN[1]);
        this._countdownStep = 1;

        if (!this._rafId) this._startLoop();
    }

    _startGame() {
        this.state = GAME_STATES.PLAYING;
        this.screens.hideAll();
        this.hud.show();
        this.keyboard.show();

        // Compute lane layout synchronously FIRST
        this._updateLaneLayout();

        // For rhythm mode: start audio THEN clock for precise sync
        if (this.mode === GAME_MODES.RHYTHM && this.trackLoader) {
            const volume = (this.screens.settings.volume || 70) / 100;
            this.trackLoader.play(volume * 0.6);
            this.trackLoader.onEnd(() => this._gameOver());
        } else {
            this.audio.startTension();
        }

        // Start clock AFTER audio — ensures no timing gap
        this.clock.start();
        this.input.enable();
    }

    _pause() {
        if (this.state !== GAME_STATES.PLAYING) return;
        this.state = GAME_STATES.PAUSED;
        this.clock.pause();
        this.input.disable();
        this.audio.suspend();

        if (this.mode === GAME_MODES.RHYTHM) {
            this.trackLoader?.pause();
        }

        this.screens.showScreen('pause');
    }

    _resume() {
        if (this.state !== GAME_STATES.PAUSED) return;
        this.state = GAME_STATES.PLAYING;
        this.screens.hideAll();

        // Resume audio BEFORE clock to maintain sync
        this.audio.resume();
        if (this.mode === GAME_MODES.RHYTHM) {
            const volume = (this.screens.settings.volume || 70) / 100;
            this.trackLoader?.play(volume * 0.6);
        }

        this.clock.resume();
        this.input.enable();
    }

    _onPauseToggle() {
        if (this.state === GAME_STATES.PLAYING) this._pause();
        else if (this.state === GAME_STATES.PAUSED) this._resume();
    }

    _gameOver() {
        this.state = GAME_STATES.GAME_OVER;
        this.input.disable();
        this.audio.stopTension();

        if (this.mode === GAME_MODES.RHYTHM) {
            this.trackLoader?.stop();
        }

        const stats = this.score.getStats();
        stats.rank = this.score.getRank();

        saveBestScore(this.mode, stats.score);
        this.screens.updateGameOver(stats);
        this.hud.hide();
        this.keyboard.hide();
        this.screens.showScreen('gameover');
    }

    _toMenu() {
        this.state = GAME_STATES.MENU;
        this.input.disable();
        this.audio.stopTension();

        if (this.mode === GAME_MODES.RHYTHM) {
            this.trackLoader?.stop();
        }

        this.hud.hide();
        this.keyboard.hide();
        this.screens.updateBestScore();
        this.screens.showScreen('menu');
    }

    _resetGame() {
        const settings = this.screens.settings;
        const layout = settings.layout || 'en';
        this.score.reset();
        this.health.reset();
        this.health.isInvulnerable = (this.mode === GAME_MODES.TRAINING || this.mode === GAME_MODES.RHYTHM);
        this.difficulty.init(settings.difficulty, layout);
        this.spawner.reset();
        this.spawner.setActiveKeys(this.difficulty.activeKeys);
        this.keyboard.setLayout(layout);
        this.keyboard.setActiveKeys(this.difficulty.activeKeys);
        this._laneLayoutReady = false;

        // Set up RhythmSpawner for rhythm mode
        if (this.mode === GAME_MODES.RHYTHM && this._beatMap) {
            this.rhythmSpawner = new RhythmSpawner(this.spawner);
            this.rhythmSpawner.setBeatMap(this._beatMap);
            this.rhythmSpawner.setActiveKeys(this.difficulty.activeKeys);
            this._rhythmBeatPulse = 0;
        } else {
            this.rhythmSpawner = null;
            this._rhythmBeatPulse = 0;
        }

        this.hud.updateScore(0);
        this.hud.updateCombo(0, 1);
        this.hud.updateHP(HEALTH.MAX_SEGMENTS, HEALTH.MAX_SEGMENTS);
        this.hud.updateBPM(this.mode === GAME_MODES.RHYTHM && this._beatMap
            ? this._beatMap.bpm
            : BPM_CONST.INITIAL);
    }

    // ═══════════════════════════════════
    //  INPUT HANDLING
    // ═══════════════════════════════════

    _onKeyPress({ key, timestamp }) {
        if (this.state !== GAME_STATES.PLAYING) return;

        this.audio.playTick();
        this.keyboard.pressKey(key);

        const elapsed = this.clock.elapsed;

        // In rhythm mode, use track time for hit matching
        if (this.mode === GAME_MODES.RHYTHM && this.rhythmSpawner && this.trackLoader) {
            const trackTime = this.trackLoader.currentTimeMs;
            const virus = this.rhythmSpawner.findMatchingVirus(key, trackTime);

            if (!virus) {
                this.score.registerHit('bad');
                this.hud.showHitFeedback('bad');
                this.effects.triggerShake(2, 80);
                return;
            }

            const arrivalTime = virus.spawnTime + virus.travelDuration;
            const timeDiff = Math.abs(arrivalTime - trackTime);
            const grade = this.score.evaluateHit(timeDiff);
            this.score.registerHit(grade);
            this.hud.showHitFeedback(grade);
            virus.hit = true;
            virus.hitGrade = grade;

            switch (grade) {
                case 'perfect':
                    this.audio.playPerfect();
                    this.particles.emit(virus.x, virus.y, '#5ec4d4', 12);
                    break;
                case 'good':
                    this.audio.playClack();
                    this.particles.emit(virus.x, virus.y, '#7fbf7f', 8);
                    break;
                case 'bad':
                    this.effects.triggerShake(3, 100);
                    this.particles.emit(virus.x, virus.y, '#d4a04a', 4);
                    break;
            }
            return;
        }

        // Standard modes — use game clock
        const virus = this.spawner.findMatchingVirus(key, elapsed);

        if (!virus) {
            this.score.registerHit('bad');
            this.hud.showHitFeedback('bad');
            this.effects.triggerShake(2, 80);
            return;
        }

        const timeDiff = Math.abs(virus.arrivalTime - elapsed);
        const grade = this.score.evaluateHit(timeDiff);
        this.score.registerHit(grade);
        this.hud.showHitFeedback(grade);

        virus.hit = true;
        virus.hitGrade = grade;

        switch (grade) {
            case 'perfect':
                this.audio.playPerfect();
                this.particles.emit(virus.x, virus.y, '#5ec4d4', 12);
                break;
            case 'good':
                this.audio.playClack();
                this.particles.emit(virus.x, virus.y, '#7fbf7f', 8);
                break;
            case 'bad':
                this.effects.triggerShake(3, 100);
                this.particles.emit(virus.x, virus.y, '#d4a04a', 4);
                break;
        }

        if (this.score.badStreak >= HEALTH.BAD_STREAK_THRESHOLD) {
            this.health.takeDamage(HEALTH.BAD_STREAK_DAMAGE);
        }
    }

    // ═══════════════════════════════════
    //  GAME LOOP
    // ═══════════════════════════════════

    _startLoop() {
        const loop = (now) => {
            this._rafId = requestAnimationFrame(loop);
            this._update(now);
            this._render();
        };
        this._rafId = requestAnimationFrame(loop);
    }

    _update(now) {
        // Countdown logic
        if (this.state === GAME_STATES.COUNTDOWN) {
            this._countdownTimer += 16;
            if (this._countdownTimer >= 800) {
                this._countdownTimer = 0;
                this._countdownStep++;
                if (this._countdownStep <= 3) {
                    this.screens.showCountdown(STRINGS.COUNTDOWN[this._countdownStep]);
                } else if (this._countdownStep === 4) {
                    this.screens.showCountdown(STRINGS.COUNTDOWN[4]);
                } else {
                    this.screens.hideCountdown();
                    this._startGame();
                }
            }
            return;
        }

        if (this.state !== GAME_STATES.PLAYING) return;

        const { steps, alpha, beatTick } = this.clock.tick(now);

        // Fixed timestep updates
        for (let i = 0; i < steps; i++) {
            if (this.mode !== GAME_MODES.RHYTHM) {
                // Standard modes: BPM-driven difficulty
                this.difficulty.update(this.clock.elapsed);
                this.clock.setBPM(this.difficulty.bpm);
                this.spawner.setSpawnRate(this.difficulty.spawnRate);
                this.spawner.setTravelDuration(this.difficulty.travelDuration);

                // Only update standard spawner in standard modes
                this.spawner.update(this.clock.elapsed);
            }

            if (this.mode === GAME_MODES.SPRINT && this.clock.elapsed >= GAME.SPRINT_DURATION) {
                this._gameOver();
                return;
            }
        }

        // Spawning and virus updates
        if (this._laneLayoutReady) {
            if (this.mode === GAME_MODES.RHYTHM && this.rhythmSpawner && this.trackLoader) {
                // Read track time ONCE per frame for consistent calculations
                const trackTime = this.trackLoader.currentTimeMs;

                // Only process if track is actually playing and has valid time
                if (trackTime > 0 || this.trackLoader.isPlaying) {
                    // Schedule spawns based on track time
                    this.rhythmSpawner.update(trackTime);
                    // Update virus positions in track-time space
                    this.rhythmSpawner.updateViruses(trackTime);
                    // Beat pulse for visual feedback
                    if (this.rhythmSpawner.beatPulse) {
                        this._rhythmBeatPulse = 1.0;
                        this.effects.triggerFlash('rgba(94, 196, 212, 0.15)', 60);
                    }
                }
                // Smooth exponential decay for beat pulse
                this._rhythmBeatPulse *= 0.92;
                if (this._rhythmBeatPulse < 0.01) this._rhythmBeatPulse = 0;
            } else if (beatTick) {
                this.spawner.onBeat(this.clock.elapsed);
            }
        }

        // Variable-rate updates
        this.effects.update(16);
        this.particles.update(16);

        if (this.mode === GAME_MODES.RHYTHM) {
            this.hud.updateBPM(this._beatMap?.bpm || 120);
        } else {
            this.hud.updateBPM(this.difficulty.bpm);
            const tensionIntensity = (this.difficulty.bpm - BPM_CONST.INITIAL) / (BPM_CONST.MAX - BPM_CONST.INITIAL);
            this.audio.setTensionIntensity(tensionIntensity);
        }

        // Rhythm mode: end when track is done
        if (this.mode === GAME_MODES.RHYTHM && this.trackLoader && !this.trackLoader.isPlaying) {
            if (this.spawner.activeViruses.length === 0 && this.rhythmSpawner?.isComplete) {
                this._gameOver();
            }
        }
    }

    _render() {
        const r = this.renderer;
        r.clear();

        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.COUNTDOWN) {
            r.drawGrid();
        }

        if (this.state === GAME_STATES.PLAYING) {
            if (this._laneLayoutReady) {
                const hly = this.keyboard.hitLineY;
                r.drawLanes(this.keyboard.keyPositions, hly);
                r.drawHitZone(this.keyboard.keyPositions, hly, this.difficulty.activeKeys, this.clock.elapsed, this._rhythmBeatPulse || 0);
                r.drawViruses(this.spawner.activeViruses, hly);
            }

            this.particles.render(r.ctx);
            this.effects.render(r.ctx, r.width, r.height);
        }
    }
}
