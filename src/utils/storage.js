/** localStorage wrapper with JSON support */

const PREFIX = 'hackswipe_';

export function saveData(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* quota exceeded — fail silently */ }
}

export function loadData(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
        return defaultValue;
    }
}

export function loadSettings() {
    return loadData('settings', {
        layout: 'en',
        difficulty: 'analyst',
        volume: 70,
        highContrast: false,
        glitchEffects: true,
        fontSize: 'medium',
    });
}

export function saveSettings(settings) {
    saveData('settings', settings);
}

export function loadBestScore(mode) {
    return loadData(`best_${mode}`, 0);
}

export function saveBestScore(mode, score) {
    const current = loadBestScore(mode);
    if (score > current) {
        saveData(`best_${mode}`, score);
    }
}
