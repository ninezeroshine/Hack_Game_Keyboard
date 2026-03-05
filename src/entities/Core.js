/**
 * Core entity — the central "firewall" that viruses attack.
 * Displays a rotating set of characters as the "password".
 */
export class Core {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.radius = 60;
        this.pulsePhase = 0;
        this.damageFlash = 0;     // > 0 means flashing red
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    update(dt) {
        this.pulsePhase += dt * 0.003;
        if (this.damageFlash > 0) {
            this.damageFlash -= dt;
        }
    }

    triggerDamageFlash() {
        this.damageFlash = 300; // ms
    }

    get currentPulse() {
        return 1 + Math.sin(this.pulsePhase) * 0.04;
    }
}
