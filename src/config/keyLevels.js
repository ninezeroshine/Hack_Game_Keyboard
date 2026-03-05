/**
 * Key level definitions — progressive difficulty through key count.
 * Supports EN (QWERTY) and RU (ЙЦУКЕН) layouts.
 */

/** English QWERTY levels */
const EN_LEVELS = {
    recruit: { label: 'RECRUIT', keys: ['f', 'j'], description: 'Index fingers only' },
    intern: { label: 'INTERN', keys: ['f', 'j', 'd', 'k'], description: 'Home row basics' },
    analyst: { label: 'ANALYST', keys: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';'], description: 'Full home row' },
    hacker: { label: 'HACKER', keys: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'e', 'i', 'r', 'u'], description: 'Home + upper row' },
    elite: { label: 'ELITE', keys: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'e', 'i', 'r', 'u', 'w', 'o', 'q', 'p', 't', 'y'], description: 'Extended keyboard' },
    grandmaster: { label: 'GRANDMASTER', keys: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';', 'e', 'i', 'r', 'u', 'w', 'o', 'q', 'p', 't', 'y', 'g', 'h', 'v', 'b', 'n', 'm'], description: 'Full keyboard' },
};

/** Russian ЙЦУКЕН levels — same finger positions, Cyrillic characters */
const RU_LEVELS = {
    recruit: { label: 'РЕКРУТ', keys: ['а', 'о'], description: 'Указательные пальцы' },
    intern: { label: 'СТАЖЁР', keys: ['а', 'о', 'в', 'л'], description: 'Домашний ряд базовый' },
    analyst: { label: 'АНАЛИТИК', keys: ['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж'], description: 'Полный домашний ряд' },
    hacker: { label: 'ХАКЕР', keys: ['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж', 'у', 'ш', 'к', 'г'], description: 'Домашний + верхний ряд' },
    elite: { label: 'ЭЛИТА', keys: ['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж', 'у', 'ш', 'к', 'г', 'ц', 'щ', 'й', 'з', 'е', 'н'], description: 'Расширенная клавиатура' },
    grandmaster: { label: 'ГРАНДМАСТЕР', keys: ['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж', 'у', 'ш', 'к', 'г', 'ц', 'щ', 'й', 'з', 'е', 'н', 'п', 'р', 'м', 'и', 'т', 'ь'], description: 'Вся клавиатура' },
};

/** All layouts */
const LAYOUTS = { en: EN_LEVELS, ru: RU_LEVELS };

/** Keyboard rows for visual display */
export const KEYBOARD_ROWS_EN = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const KEYBOARD_ROWS_RU = [
    ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з'],
    ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж'],
    ['я', 'ч', 'с', 'м', 'и', 'т', 'ь'],
];

/** Get keyboard rows for a layout */
export function getKeyboardRows(layout) {
    return layout === 'ru' ? KEYBOARD_ROWS_RU : KEYBOARD_ROWS_EN;
}

/** Ordered level names for progression */
export const LEVEL_ORDER = ['recruit', 'intern', 'analyst', 'hacker', 'elite', 'grandmaster'];

/** Get keys for a specific difficulty level and layout */
export function getKeysForLevel(levelName, layout = 'en') {
    const levels = LAYOUTS[layout] || LAYOUTS.en;
    return levels[levelName]?.keys ?? levels.analyst.keys;
}

/** Get level metadata */
export function getLevelMeta(levelName, layout = 'en') {
    const levels = LAYOUTS[layout] || LAYOUTS.en;
    return levels[levelName] ?? levels.analyst;
}

/** Get keys to add when progressing from one level to the next */
export function getNewKeysForLevel(levelName, layout = 'en') {
    const levels = LAYOUTS[layout] || LAYOUTS.en;
    const idx = LEVEL_ORDER.indexOf(levelName);
    if (idx <= 0) return levels[levelName]?.keys ?? [];
    const prevKeys = new Set(levels[LEVEL_ORDER[idx - 1]].keys);
    return levels[levelName].keys.filter(k => !prevKeys.has(k));
}

export default LAYOUTS;
