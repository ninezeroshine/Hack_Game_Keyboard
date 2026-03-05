import { randomRange } from '../utils/math.js';

/**
 * Effects layer — screen shake, glitch, and flash effects rendered on canvas.
 */
export class EffectsLayer {
    constructor() {
        this.shakeX = 0;
        this.shakeY = 0;
        this._shakeDuration = 0;
        this._shakeIntensity = 0;

        this.glitchActive = false;
        this._glitchDuration = 0;
        this._glitchLines = [];

        this.flashColor = null;
        this._flashDuration = 0;

        this.enabled = true; // can be disabled in settings
    }

    triggerShake(intensity = 4, duration = 150) {
        if (!this.enabled) return;
        this._shakeIntensity = intensity;
        this._shakeDuration = duration;
    }

    triggerGlitch(duration = 120) {
        if (!this.enabled) return;
        this.glitchActive = true;
        this._glitchDuration = duration;
        this._glitchLines = [];
        const lineCount = Math.floor(randomRange(2, 5));
        for (let i = 0; i < lineCount; i++) {
            this._glitchLines.push({
                y: randomRange(0, 1),
                height: randomRange(2, 8),
                offset: randomRange(-10, 10),
            });
        }
    }

    triggerFlash(color = '#00e5ff', duration = 80) {
        if (!this.enabled) return;
        this.flashColor = color;
        this._flashDuration = duration;
    }

    update(dt) {
        // Shake decay
        if (this._shakeDuration > 0) {
            this._shakeDuration -= dt;
            const progress = this._shakeDuration / 150;
            this.shakeX = randomRange(-1, 1) * this._shakeIntensity * progress;
            this.shakeY = randomRange(-1, 1) * this._shakeIntensity * progress;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        // Glitch decay
        if (this._glitchDuration > 0) {
            this._glitchDuration -= dt;
            if (this._glitchDuration <= 0) {
                this.glitchActive = false;
            }
        }

        // Flash decay
        if (this._flashDuration > 0) {
            this._flashDuration -= dt;
            if (this._flashDuration <= 0) {
                this.flashColor = null;
            }
        }
    }

    render(ctx, width, height) {
        // Apply shake as canvas transform
        if (this.shakeX !== 0 || this.shakeY !== 0) {
            ctx.save();
            ctx.translate(this.shakeX, this.shakeY);
        }

        // Glitch lines
        if (this.glitchActive && this.enabled) {
            for (const line of this._glitchLines) {
                const y = line.y * height;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, y, width, line.height);
                ctx.clip();
                ctx.translate(line.offset, 0);
                // RGB shift effect
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
                ctx.fillRect(0, y, width, line.height);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
                ctx.fillRect(2, y, width, line.height);
                ctx.globalCompositeOperation = 'source-over';
                ctx.restore();
            }
        }

        // Full-screen flash
        if (this.flashColor && this.enabled) {
            const alpha = this._flashDuration / 80;
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = alpha * 0.15;
            ctx.fillRect(0, 0, width, height);
            ctx.globalAlpha = 1;
        }

        if (this.shakeX !== 0 || this.shakeY !== 0) {
            ctx.restore();
        }
    }
}
