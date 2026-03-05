/**
 * BeatDetector v3 — robust offline beat detection using comb filter tracking.
 *
 * Why comb filter? Previous approaches (onset snapping, grid quantization)
 * failed because if BPM estimation was even slightly wrong, the entire beat
 * grid was off-rhythm. The comb filter approach generates beats DIRECTLY
 * from the audio signal, ensuring they always match what you hear.
 *
 * Pipeline:
 * 1. Decode to mono PCM
 * 2. Compute onset detection function (ODF) via spectral flux
 * 3. Estimate BPM via autocorrelation of ODF (robust to octave errors)
 * 4. Comb filter alignment — sweep the grid phase to maximize overlap with ODF
 * 5. Generate grid-locked beats, filter silent sections
 * 6. For higher sensitivity, add rhythmic subdivisions (eighth/sixteenth notes)
 *
 * Sensitivity now controls SUBDIVISION LEVEL, not onset threshold:
 * - 1: Quarter notes only, skip silent beats
 * - 2: Quarter notes, include most beats
 * - 3: Quarter notes + eighth notes at strong transients
 * - 4: Quarter + eighth notes
 * - 5: Quarter + eighth + some sixteenth notes
 *
 * ALL beats are ALWAYS on a rhythmic grid. No off-grid notes ever.
 */

const FFT_SIZE = 2048;
const HOP_SIZE = 512;

// Frequency bands for spectral flux (Hz ranges)
const BAND_RANGES = [
    { loHz: 20, hiHz: 300, weight: 2.0 },    // Low — kick/bass
    { loHz: 300, hiHz: 2000, weight: 1.0 },   // Mid — snare/vocals
    { loHz: 2000, hiHz: 8000, weight: 0.5 },  // High — hi-hats
];

const SENSITIVITY_PRESETS = {
    //  beatSkip: keep every Nth beat (4=one per bar, 2=half, 1=all)
    //  subdivision: note division (1=quarter, 2=eighth)
    //  silenceGate: energy threshold to skip quiet beats
    1: { subdivision: 1, silenceGate: 0.10, beatSkip: 4 },  // Chill — 1 beat per bar
    2: { subdivision: 1, silenceGate: 0.10, beatSkip: 2 },  // Relaxed — every other beat
    3: { subdivision: 1, silenceGate: 0.25, beatSkip: 1 },  // Easy — quarters, skip quiet
    4: { subdivision: 1, silenceGate: 0.08, beatSkip: 1 },  // Normal — all quarter notes
    5: { subdivision: 2, silenceGate: 0.35, beatSkip: 1 },  // Hard — + eighth notes at drops
};

export class BeatDetector {
    /**
     * @param {AudioBuffer} audioBuffer
     * @param {number} [sensitivity=3]
     * @param {function} [onProgress]
     * @returns {Promise<BeatMap>}
     */
    async analyze(audioBuffer, sensitivity = 3, onProgress) {
        const sr = audioBuffer.sampleRate;
        const mono = this._getMono(audioBuffer);
        const durationMs = audioBuffer.duration * 1000;
        const hopMs = (HOP_SIZE / sr) * 1000;
        const preset = SENSITIVITY_PRESETS[sensitivity] || SENSITIVITY_PRESETS[3];

        onProgress?.(0.05);
        await this._yield();

        // ── Phase 1: Onset detection function ──
        const odf = this._computeODF(mono, sr);
        onProgress?.(0.30);
        await this._yield();

        // ── Phase 2: Energy envelope for silence gating ──
        const energy = this._computeEnergy(mono, sr);
        onProgress?.(0.40);
        await this._yield();

        // ── Phase 3: BPM via autocorrelation (robust, handles octave errors) ──
        const bpm = this._estimateBPM(odf, hopMs);
        onProgress?.(0.60);
        await this._yield();

        // ── Phase 4: Comb filter phase alignment ──
        const beatIntervalMs = 60000 / bpm;
        const phase = this._findBestPhase(odf, hopMs, beatIntervalMs, durationMs);
        onProgress?.(0.75);
        await this._yield();

        // ── Phase 5: Generate grid beats with silence gating ──
        const beats = this._generateBeats(
            bpm, phase, durationMs, preset, odf, energy, hopMs
        );
        onProgress?.(0.95);
        await this._yield();

        onProgress?.(1.0);

        return {
            beats,
            bpm: Math.round(bpm),
            duration: durationMs,
            totalBeats: beats.length,
            gridIntervalMs: beatIntervalMs,
            phase,
        };
    }

    // ═══════════════════════════════════════════
    //  MONO CONVERSION
    // ═══════════════════════════════════════════

    _getMono(buf) {
        if (buf.numberOfChannels === 1) return buf.getChannelData(0);
        const L = buf.getChannelData(0);
        const R = buf.getChannelData(1);
        const m = new Float32Array(L.length);
        for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) * 0.5;
        return m;
    }

    // ═══════════════════════════════════════════
    //  ONSET DETECTION FUNCTION (spectral flux)
    // ═══════════════════════════════════════════

    _computeODF(samples, sr) {
        const n = Math.floor((samples.length - FFT_SIZE) / HOP_SIZE);
        const odf = new Float32Array(n);

        // Hann window
        const win = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
        }

        // Hz-to-bin conversion
        const binHz = sr / FFT_SIZE;
        const bands = BAND_RANGES.map(b => ({
            lo: Math.max(1, Math.round(b.loHz / binHz)),
            hi: Math.min(FFT_SIZE / 2 - 1, Math.round(b.hiHz / binHz)),
            weight: b.weight,
        }));

        // Previous magnitudes per band
        const prevMag = bands.map(b => new Float32Array(b.hi - b.lo + 1));
        const real = new Float32Array(FFT_SIZE);
        const imag = new Float32Array(FFT_SIZE);

        for (let f = 0; f < n; f++) {
            const off = f * HOP_SIZE;
            for (let i = 0; i < FFT_SIZE; i++) {
                real[i] = samples[off + i] * win[i];
                imag[i] = 0;
            }
            this._fft(real, imag, FFT_SIZE);

            let totalFlux = 0;
            for (let b = 0; b < bands.length; b++) {
                const { lo, hi, weight } = bands[b];
                let flux = 0;
                for (let k = lo; k <= hi; k++) {
                    const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
                    const diff = mag - prevMag[b][k - lo];
                    if (diff > 0) flux += diff;
                    prevMag[b][k - lo] = mag;
                }
                totalFlux += flux * weight;
            }
            odf[f] = totalFlux;
        }

        return odf;
    }

    // ═══════════════════════════════════════════
    //  ENERGY ENVELOPE (for silence gating)
    // ═══════════════════════════════════════════

    _computeEnergy(samples, sr) {
        const hopSamples = HOP_SIZE;
        const n = Math.floor(samples.length / hopSamples);
        const env = new Float32Array(n);
        for (let f = 0; f < n; f++) {
            let sum = 0;
            const off = f * hopSamples;
            const end = Math.min(off + hopSamples, samples.length);
            for (let i = off; i < end; i++) {
                sum += samples[i] * samples[i];
            }
            env[f] = Math.sqrt(sum / (end - off));
        }

        // Normalize to [0, 1]
        let maxE = 0;
        for (let i = 0; i < n; i++) if (env[i] > maxE) maxE = env[i];
        if (maxE > 0) for (let i = 0; i < n; i++) env[i] /= maxE;

        return env;
    }

    // ═══════════════════════════════════════════
    //  BPM ESTIMATION via autocorrelation
    // ═══════════════════════════════════════════

    _estimateBPM(odf, hopMs) {
        // Autocorrelation of ODF
        // BPM range: 60–220 → period 273ms–1000ms → lags accordingly
        const minBPM = 60, maxBPM = 220;
        const minLag = Math.max(1, Math.floor(60000 / maxBPM / hopMs));
        const maxLag = Math.min(odf.length / 2, Math.ceil(60000 / minBPM / hopMs));

        const acf = new Float32Array(maxLag + 1);
        const len = odf.length;

        // Use entire track for autocorrelation (more data → better estimate)
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < len - lag; i++) {
                sum += odf[i] * odf[i + lag];
            }
            acf[lag] = sum / (len - lag);
        }

        // Find the top 5 peaks in the ACF
        const peaks = this._findACFPeaks(acf, minLag, maxLag, hopMs);

        if (peaks.length === 0) return 120;

        // Score each candidate BPM by checking harmonics
        // A correct BPM should have strong ACF at lag, 2*lag, 3*lag...
        let bestBPM = peaks[0].bpm;
        let bestScore = -Infinity;

        for (const peak of peaks) {
            let score = peak.value;

            // Check harmonics (2x, 3x period)
            for (const mult of [2, 3]) {
                const harmLag = Math.round(peak.lag * mult);
                if (harmLag < acf.length) {
                    score += acf[harmLag] * (1 / mult);
                }
            }

            // Check sub-harmonic (half period = double BPM)
            const halfLag = Math.round(peak.lag / 2);
            if (halfLag >= minLag && halfLag < acf.length) {
                score += acf[halfLag] * 0.3;
            }

            if (score > bestScore) {
                bestScore = score;
                bestBPM = peak.bpm;
            }
        }

        // ── Octave error resolution ──
        // Test if double or half BPM fits the ODF better
        bestBPM = this._resolveOctaveError(bestBPM, odf, hopMs);

        return Math.max(minBPM, Math.min(maxBPM, bestBPM));
    }

    /**
     * Find peaks in the autocorrelation function.
     * Returns top candidates sorted by ACF value.
     */
    _findACFPeaks(acf, minLag, maxLag, hopMs) {
        const peaks = [];

        for (let i = minLag + 1; i < maxLag - 1; i++) {
            if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1]) {
                peaks.push({
                    lag: i,
                    value: acf[i],
                    bpm: 60000 / (i * hopMs),
                });
            }
        }

        // Sort by ACF value, take top 8
        peaks.sort((a, b) => b.value - a.value);
        return peaks.slice(0, 8);
    }

    /**
     * Resolve octave error: BPM might be detected as half or double.
     * Test BPM, BPM*2, BPM/2 with comb filter and pick best.
     */
    _resolveOctaveError(bpm, odf, hopMs) {
        const candidates = [bpm];
        if (bpm * 2 <= 220) candidates.push(bpm * 2);
        if (bpm / 2 >= 60) candidates.push(bpm / 2);

        let best = bpm;
        let bestScore = -Infinity;

        for (const candidateBPM of candidates) {
            const period = 60000 / candidateBPM;
            const lagFrames = period / hopMs;

            // Quick comb filter score: sum ODF at lag intervals
            let score = 0;
            let count = 0;
            for (let t = 0; t < odf.length; t++) {
                // How close is this frame to a grid line?
                const nearestBeat = Math.round(t / lagFrames) * lagFrames;
                const dist = Math.abs(t - nearestBeat);
                if (dist <= 1.5) { // within ~1.5 frames of a grid line
                    score += odf[t];
                    count++;
                }
            }

            // Normalize by number of grid lines tested
            if (count > 0) score /= count;

            // Slight bias toward keeping current BPM to avoid unnecessary changes
            if (candidateBPM === bpm) score *= 1.05;

            // Prefer BPM that's in playable range for a game (80-180)
            // but only a VERY slight bias — not enough to override strong evidence
            if (candidateBPM >= 80 && candidateBPM <= 180) score *= 1.03;

            if (score > bestScore) {
                bestScore = score;
                best = candidateBPM;
            }
        }

        return best;
    }

    // ═══════════════════════════════════════════
    //  COMB FILTER PHASE ALIGNMENT
    // ═══════════════════════════════════════════

    /**
     * Find the optimal phase (offset) for the beat grid.
     * Sweeps through all possible phases and picks the one that
     * maximizes overlap with the ODF — like aligning a ruler to marks on paper.
     */
    _findBestPhase(odf, hopMs, beatIntervalMs, durationMs) {
        const lagFrames = beatIntervalMs / hopMs;
        const numPhases = Math.max(64, Math.round(lagFrames)); // test every frame
        let bestPhase = 0;
        let bestScore = -Infinity;

        for (let p = 0; p < numPhases; p++) {
            const phaseMs = (p / numPhases) * beatIntervalMs;
            const phaseFrames = phaseMs / hopMs;
            let score = 0;

            // Sum ODF values at each grid position for this phase
            let gridTime = phaseFrames;
            while (gridTime < odf.length) {
                // Interpolate ODF value at non-integer frame position
                const f = Math.floor(gridTime);
                const frac = gridTime - f;
                if (f >= 0 && f + 1 < odf.length) {
                    const val = odf[f] * (1 - frac) + odf[f + 1] * frac;
                    score += val;
                }
                gridTime += lagFrames;
            }

            if (score > bestScore) {
                bestScore = score;
                bestPhase = phaseMs;
            }
        }

        return bestPhase;
    }

    // ═══════════════════════════════════════════
    //  BEAT GENERATION
    // ═══════════════════════════════════════════

    /**
     * Generate the final list of beat times.
     * Always grid-locked. Sensitivity controls subdivision level.
     */
    _generateBeats(bpm, phase, durationMs, preset, odf, energy, hopMs) {
        const quarterInterval = 60000 / bpm;
        const subInterval = quarterInterval / preset.subdivision;

        // Generate all possible beat times (including subdivisions)
        const allBeats = [];
        let t = phase;
        while (t < durationMs) {
            if (t >= 0) {
                allBeats.push(Math.round(t));
            }
            t += subInterval;
        }

        // Compute median energy for the silence gate threshold
        const sortedEnergy = [...energy].sort((a, b) => a - b);
        const medianEnergy = sortedEnergy[Math.floor(sortedEnergy.length * 0.5)];
        const gateThreshold = medianEnergy * preset.silenceGate;

        // Filter: remove beats during silence
        const gated = [];
        for (const beatMs of allBeats) {
            const frameIdx = Math.round(beatMs / hopMs);

            // Check energy around this beat (±3 frames)
            let localEnergy = 0;
            let count = 0;
            for (let f = frameIdx - 3; f <= frameIdx + 3; f++) {
                if (f >= 0 && f < energy.length) {
                    localEnergy += energy[f];
                    count++;
                }
            }
            localEnergy = count > 0 ? localEnergy / count : 0;

            // Include beat if there's enough energy
            if (localEnergy >= gateThreshold) {
                gated.push(beatMs);
            }
        }

        // Apply beat skip — keep every Nth beat for lower density
        const skip = preset.beatSkip || 1;
        let beats;
        if (skip > 1) {
            beats = gated.filter((_, i) => i % skip === 0);
        } else {
            beats = gated;
        }

        // Safety: if we filtered too aggressively, fall back
        if (beats.length < 8 && durationMs > 10000) {
            const fallback = [];
            t = phase;
            const fallbackInterval = quarterInterval * Math.max(1, skip);
            while (t < durationMs) {
                if (t >= 0) fallback.push(Math.round(t));
                t += fallbackInterval;
            }
            return fallback;
        }

        return beats;
    }

    // ═══════════════════════════════════════════
    //  FFT (radix-2 Cooley-Tukey)
    // ═══════════════════════════════════════════

    _fft(real, imag, n) {
        let j = 0;
        for (let i = 1; i < n; i++) {
            let bit = n >> 1;
            while (j & bit) { j ^= bit; bit >>= 1; }
            j ^= bit;
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const ang = -2 * Math.PI / len;
            const wR = Math.cos(ang), wI = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let cR = 1, cI = 0;
                for (let k = 0; k < half; k++) {
                    const a = i + k, b = a + half;
                    const tR = cR * real[b] - cI * imag[b];
                    const tI = cR * imag[b] + cI * real[b];
                    real[b] = real[a] - tR;
                    imag[b] = imag[a] - tI;
                    real[a] += tR;
                    imag[a] += tI;
                    const nr = cR * wR - cI * wI;
                    cI = cR * wI + cI * wR;
                    cR = nr;
                }
            }
        }
    }

    _yield() {
        return new Promise(r => setTimeout(r, 0));
    }
}
