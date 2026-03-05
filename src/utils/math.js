/** Math helpers */

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

export function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Ease out cubic */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/** Ease in cubic */
export function easeInCubic(t) {
    return t * t * t;
}

/** Random angle in radians */
export function randomAngle() {
    return Math.random() * Math.PI * 2;
}

/** Distance between two points */
export function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}
