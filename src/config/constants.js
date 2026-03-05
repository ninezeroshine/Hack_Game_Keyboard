/** All game constants — single source of truth */

export const GAME = {
    FIXED_TIMESTEP: 20,            // ms (50 Hz logic updates)
    MAX_DELTA: 200,                // ms max frame skip
    CANVAS_BG: '#0c1018',
    SPRINT_DURATION: 150_000,      // 2.5 minutes
};

export const HIT_WINDOWS = {
    PERFECT: 100,  // ±ms
    GOOD: 200,
    BAD: 300,
};

export const SCORING = {
    BASE_POINTS: 100,
    PERFECT_MULT: 2.0,
    GOOD_MULT: 1.5,
    BAD_MULT: 0.5,
    COMBO_BONUS: 0.1,             // +10% per combo step
    MAX_COMBO_MULT: 5.0,
};

export const HEALTH = {
    MAX_SEGMENTS: 5,
    MISS_DAMAGE: 1,
    BAD_STREAK_THRESHOLD: 3,      // 3 bad in a row = 1 damage
    BAD_STREAK_DAMAGE: 1,
};

export const VIRUS = {
    TRAVEL_TIME_BASE: 3000,       // ms to reach core (comfortable start)
    TRAVEL_TIME_MIN: 1000,        // fastest possible
    SIZE_BASE: 32,                // px
    SIZE_HIT_ZONE: 52,            // px — larger for easier targeting  
    SPAWN_MARGIN: 80,             // px from canvas edge
};

export const BPM = {
    INITIAL: 70,                   // relaxed start
    MAX: 180,
    GROWTH_PER_SECOND: 0.2,       // gentle BPM increase per second
};

export const RANKS = {
    S: { minAccuracy: 0.95, minCombo: 50 },
    A: { minAccuracy: 0.80, minCombo: 30 },
    B: { minAccuracy: 0.60, minCombo: 15 },
};

export const GAME_STATES = {
    MENU: 'MENU',
    TUTORIAL: 'TUTORIAL',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    SETTINGS: 'SETTINGS',
    ANALYZING: 'ANALYZING',
};

export const GAME_MODES = {
    SPRINT: 'SPRINT',
    ENDLESS: 'ENDLESS',
    TRAINING: 'TRAINING',
    RHYTHM: 'RHYTHM',
};
