import { GAME, VIRUS } from '../config/constants.js';

/**
 * Canvas 2D renderer — lane-based falling viruses.
 * Draws: background grid, lane guides, hit zone, target markers, viruses.
 */

/** Height of the "press now" zone in pixels */
const HIT_ZONE_HEIGHT = 60;

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.centerX = 0;
        this.centerY = 0;
        this._resize();
        this._onResize = this._resize.bind(this);
        window.addEventListener('resize', this._onResize);
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    clear() {
        this.ctx.fillStyle = GAME.CANVAS_BG;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /** Draw subtle lane guide lines from top to the hit zone */
    drawLanes(keyPositions, hitLineY) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(140, 207, 170, 0.04)';
        ctx.lineWidth = 1;

        for (const [, x] of keyPositions) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, hitLineY);
            ctx.stroke();
        }
    }

    /**
     * Draw the prominent hit zone — a glowing band + target markers.
     * This is where the player should press the key.
     */
    drawHitZone(keyPositions, hitLineY, activeKeys, gameTime, beatPulse = 0) {
        const ctx = this.ctx;
        const zoneTop = hitLineY - HIT_ZONE_HEIGHT;

        // Beat pulse amplifies the glow
        const pulseBoost = beatPulse * 0.15;

        // Glowing band background
        const grad = ctx.createLinearGradient(0, zoneTop - 10, 0, hitLineY);
        grad.addColorStop(0, 'rgba(90, 175, 188, 0)');
        grad.addColorStop(0.2, `rgba(90, 175, 188, ${0.06 + pulseBoost})`);
        grad.addColorStop(0.7, `rgba(90, 175, 188, ${0.1 + pulseBoost * 2})`);
        grad.addColorStop(1, `rgba(90, 175, 188, ${0.03 + pulseBoost})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, zoneTop - 10, this.width, HIT_ZONE_HEIGHT + 10);

        // Top border of hit zone — bright line
        ctx.strokeStyle = 'rgba(94, 196, 212, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(0, zoneTop);
        ctx.lineTo(this.width, zoneTop);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bottom border — the "perfect" line (solid, brighter)
        ctx.strokeStyle = 'rgba(94, 196, 212, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, hitLineY);
        ctx.lineTo(this.width, hitLineY);
        ctx.stroke();

        // Subtle pulse on the perfect line (amplified by beat pulse)
        const pulse = 0.3 + 0.1 * Math.sin(gameTime * 0.003) + beatPulse * 0.4;
        ctx.strokeStyle = `rgba(94, 196, 212, ${pulse})`;
        ctx.lineWidth = 4 + beatPulse * 4;
        ctx.beginPath();
        ctx.moveTo(0, hitLineY);
        ctx.lineTo(this.width, hitLineY);
        ctx.stroke();

        // Target markers on each active lane
        const markerSize = 20;
        const activeSet = new Set(activeKeys);
        for (const [key, x] of keyPositions) {
            if (!activeSet.has(key)) continue;

            // Diamond marker at the hit line
            ctx.strokeStyle = 'rgba(94, 196, 212, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, hitLineY - markerSize / 2);
            ctx.lineTo(x + markerSize / 2, hitLineY);
            ctx.lineTo(x, hitLineY + markerSize / 2);
            ctx.lineTo(x - markerSize / 2, hitLineY);
            ctx.closePath();
            ctx.stroke();
        }
    }

    /** Draw falling viruses with clear hit-zone feedback */
    drawViruses(viruses, hitLineY) {
        const ctx = this.ctx;
        const zoneTop = hitLineY - HIT_ZONE_HEIGHT;

        for (const v of viruses) {
            if (!v.alive) continue;

            const size = VIRUS.SIZE_BASE * v.scale;

            // Fade-in during first 15% of travel
            const fadeIn = v.progress < 0.15 ? v.progress / 0.15 : 1;
            ctx.globalAlpha = v.opacity * fadeIn;

            const displayKey = v.key === ';' ? ';' : v.key.toUpperCase();

            // Determine visual state based on position
            let color = '#8ccfaa';
            let glowColor = null;
            let glowSize = 0;
            const inHitZone = v.y >= zoneTop && v.y <= hitLineY + 10;
            const pastHitLine = v.y > hitLineY;

            if (v.hit) {
                // Hit feedback colors
                if (v.hitGrade === 'perfect') color = '#5ec4d4';
                else if (v.hitGrade === 'good') color = '#7fbf7f';
                else if (v.hitGrade === 'bad') color = '#d4a04a';
            } else if (inHitZone) {
                // IN THE HIT ZONE — make it very obvious
                color = '#5ec4d4';
                glowColor = '#5ec4d4';
                // Stronger glow the closer to the perfect line
                const zoneProgress = (v.y - zoneTop) / HIT_ZONE_HEIGHT;
                glowSize = 6 + zoneProgress * 12;

                // Draw a connecting line from virus to its target marker
                ctx.strokeStyle = `rgba(94, 196, 212, ${0.15 + zoneProgress * 0.2})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(v.x, v.y + size / 2);
                ctx.lineTo(v.x, hitLineY);
                ctx.stroke();
            } else if (pastHitLine && !v.hit) {
                // Missed zone — red warning
                color = '#d45a5a';
                glowColor = '#d45a5a';
                glowSize = 6;
            }

            // Apply glow
            if (glowColor) {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = glowSize;
            }

            // Draw the character
            ctx.font = `700 ${size}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            ctx.fillText(displayKey, v.x, v.y);

            // Draw bracket frame around character in hit zone
            if (inHitZone && !v.hit) {
                const bw = size * 0.7;
                const bh = size * 0.9;
                ctx.strokeStyle = `rgba(94, 196, 212, 0.4)`;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(v.x - bw / 2, v.y - bh / 2, bw, bh);
            }

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    /** Subtle background grid */
    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(140, 207, 170, 0.02)';
        ctx.lineWidth = 1;

        for (let y = 0; y < this.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        for (let x = 0; x < this.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
    }

    destroy() {
        window.removeEventListener('resize', this._onResize);
    }
}
