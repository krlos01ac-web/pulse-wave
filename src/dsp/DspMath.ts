/**
 * Módulo de Funções Matemáticas Puras de DSP (Digital Signal Processing).
 * Partilhado entre o Web Worker de áudio em tempo real e a Timeline Determinística de exportação.
 */

export interface DspResult {
  spectrum: Float32Array; // 120 bandas CQT normalizadas [0..1]
  bassKick: number;       // Impacto do bumbo/sub-bass [0..1]
  energy: number;         // Energia média global
  cumulative: number;     // Energia acumulada
}

export class DspProcessor {
  private n: number;
  private sampleRate: number;
  private outputBands: number;
  private hannWindow: Float32Array;
  private smoothedSpectrum: Float32Array;
  private bassEnergyHistory: Float32Array;
  private historyIndex: number = 0;
  private bassKickDecay: number = 0;
  private cumulativeEnergy: number = 0;

  private minFreq: number = 25;
  private maxFreq: number = 16000;

  constructor(n: number = 2048, sampleRate: number = 44100, outputBands: number = 120) {
    this.n = n;
    this.sampleRate = sampleRate;
    this.outputBands = outputBands;

    this.hannWindow = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    }

    this.smoothedSpectrum = new Float32Array(outputBands);
    this.bassEnergyHistory = new Float32Array(30);
  }

  public reset(): void {
    this.smoothedSpectrum.fill(0);
    this.bassEnergyHistory.fill(0);
    this.historyIndex = 0;
    this.bassKickDecay = 0;
    this.cumulativeEnergy = 0;
  }

  /**
   * FFT Radix-2 rápida in-place (Cooley-Tukey decimation-in-time)
   */
  private computeFFT(real: Float32Array, imag: Float32Array, n: number): void {
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tempR = real[i];
        real[i] = real[j];
        real[j] = tempR;

        const tempI = imag[i];
        imag[i] = imag[j];
        imag[j] = tempI;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wR = 1;
        let wI = 0;
        for (let k = 0; k < half; k++) {
          const idx1 = i + k;
          const idx2 = i + k + half;

          const uR = real[idx1];
          const uI = imag[idx1];

          const tR = wR * real[idx2] - wI * imag[idx2];
          const tI = wR * imag[idx2] + wI * real[idx2];

          real[idx1] = uR + tR;
          imag[idx1] = uI + tI;

          real[idx2] = uR - tR;
          imag[idx2] = uI - tI;

          const nextWR = wR * wStepR - wI * wStepI;
          const nextWI = wR * wStepI + wI * wStepR;
          wR = nextWR;
          wI = nextWI;
        }
      }
    }
  }

  /**
   * Processa um bloco de amostras PCM e retorna o espectro CQT e métricas de impacto
   */
  public process(samples: Float32Array): DspResult {
    const n = this.n;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    // Janelamento Hann
    const len = Math.min(samples.length, n);
    for (let i = 0; i < len; i++) {
      real[i] = samples[i] * this.hannWindow[i];
      imag[i] = 0;
    }

    this.computeFFT(real, imag, n);

    const halfN = n / 2;
    const linearMagnitudes = new Float32Array(halfN);
    for (let i = 0; i < halfN; i++) {
      linearMagnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
    }

    const nyquist = this.sampleRate / 2;
    const binResolution = this.sampleRate / n;

    let totalEnergy = 0;
    let bassEnergy = 0;
    const cqtSpectrum = new Float32Array(this.outputBands);

    // Mapeamento Logarítmico CQT + Spectral Tilt
    for (let b = 0; b < this.outputBands; b++) {
      const ratio = b / (this.outputBands - 1);
      const centerFreq = this.minFreq * Math.pow(this.maxFreq / this.minFreq, ratio);

      const bandwidth = Math.max(binResolution, centerFreq * 0.08);
      const lowFreq = Math.max(0, centerFreq - bandwidth * 0.5);
      const highFreq = Math.min(nyquist, centerFreq + bandwidth * 0.5);

      const startBin = Math.max(0, Math.floor(lowFreq / binResolution));
      const endBin = Math.min(halfN - 1, Math.ceil(highFreq / binResolution));

      let sum = 0;
      let count = 0;
      for (let bin = startBin; bin <= endBin; bin++) {
        sum += linearMagnitudes[bin];
        count++;
      }
      let bandMag = count > 0 ? sum / count : 0;

      // Compensação de Spectral Tilt (+4 dB/oitava)
      const tiltGain = Math.pow(centerFreq / 250, 0.45);
      bandMag *= tiltGain * 8.0;

      // Compressão logarítmica para sensibilidade auditiva
      bandMag = Math.log10(1 + bandMag * 9);
      bandMag = Math.min(1.0, Math.max(0.0, bandMag));

      if (centerFreq <= 140) {
        bassEnergy += bandMag;
      }
      totalEnergy += bandMag;

      // Smoothing temporal assimétrico (Attack 0.65 / Decay 0.18)
      const attack = 0.65;
      const decay = 0.18;
      if (bandMag > this.smoothedSpectrum[b]) {
        this.smoothedSpectrum[b] = attack * bandMag + (1 - attack) * this.smoothedSpectrum[b];
      } else {
        this.smoothedSpectrum[b] = decay * bandMag + (1 - decay) * this.smoothedSpectrum[b];
      }

      cqtSpectrum[b] = this.smoothedSpectrum[b];
    }

    // Deteção de Transientes (Bass Kick)
    this.bassEnergyHistory[this.historyIndex] = bassEnergy;
    this.historyIndex = (this.historyIndex + 1) % this.bassEnergyHistory.length;

    let avgBass = 0;
    for (let i = 0; i < this.bassEnergyHistory.length; i++) {
      avgBass += this.bassEnergyHistory[i];
    }
    avgBass /= this.bassEnergyHistory.length;

    const kickRatio = avgBass > 0.01 ? bassEnergy / avgBass : 0;
    if (kickRatio > 1.35 && bassEnergy > 0.15) {
      const rawKick = Math.min(1.0, (kickRatio - 1.35) * 1.5 + 0.3);
      this.bassKickDecay = Math.max(this.bassKickDecay, rawKick);
    } else {
      this.bassKickDecay *= 0.88;
    }

    const normalizedAvgEnergy = totalEnergy / this.outputBands;
    this.cumulativeEnergy += normalizedAvgEnergy * 0.05;

    return {
      spectrum: cqtSpectrum,
      bassKick: this.bassKickDecay,
      energy: normalizedAvgEnergy,
      cumulative: this.cumulativeEnergy,
    };
  }
}
