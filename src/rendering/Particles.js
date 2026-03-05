import { randomRange, randomAngle } from '../utils/math.js';

/**
 * Particle system — small particles burst on virus hit.
 * Uses a pre-allocated array for zero GC.
 */
const MAX_PARTICLES = 200;

export class Particles {
    constructor() {
        this._particles = [];
        for (let i = 0; i < MAX_PARTICLES; i++) {
            this._particles.push({
                alive: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: 0,
                maxLife: 0,
                color: '#00ff41',
                size: 2,
            });
        }
    }

    emit(x, y, color = '#00ff41', count = 8) {
        let spawned = 0;
        for (const p of this._particles) {
            if (p.alive || spawned >= count) continue;

            const angle = randomAngle();
            const speed = randomRange(1, 4);
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = randomRange(200, 500);
            p.maxLife = p.life;
            p.color = color;
            p.size = randomRange(1.5, 3.5);
            p.alive = true;
            spawned++;
        }
    }

    update(dt) {
        for (const p of this._particles) {
            if (!p.alive) continue;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02; // tiny gravity
            p.life -= dt;
            if (p.life <= 0) p.alive = false;
        }
    }

    render(ctx) {
        for (const p of this._particles) {
            if (!p.alive) continue;
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
}
