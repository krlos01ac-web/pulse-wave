/**
 * OfflineAudioAnalyzer: Extração determinística de FFT e telemetria espectral offline
 * baseada em AudioBuffer descompactado para o relógio da timeline de exportação.
 */

import { DspProcessor, type DspResult } from './DspMath';

export interface AudioAnalysisFrame {
  time: number;
  spectrum: Float32Array; // 120 bandas CQT [0..1]
  bassImpact: number;     // Impacto sub-graves [0..1]
  energy: number;         // Energia média global [0..1]
  cumulative: number;     // Energia acumulada
  timeDomain: Float32Array; // Amostras PCM no domínio do tempo
}

export class OfflineAudioAnalyzer {
  private sampleRate: number;
  private duration: number;
  private channels: number;
  private channelPointers: Float32Array[] = [];
  private totalSamples: number;

  private fftSize: number;
  private dspProcessor: DspProcessor;

  constructor(audioBuffer: AudioBuffer, outputBands: number = 120, fftSize: number = 2048) {
    this.sampleRate = audioBuffer.sampleRate;
    this.duration = audioBuffer.duration;
    this.channels = audioBuffer.numberOfChannels;
    this.totalSamples = audioBuffer.length;
    this.fftSize = fftSize;

    // Cache dos ponteiros dos canais para acesso zero-cost
    for (let c = 0; c < this.channels; c++) {
      this.channelPointers.push(audioBuffer.getChannelData(c));
    }

    this.dspProcessor = new DspProcessor(fftSize, this.sampleRate, outputBands);
  }

  public reset(): void {
    this.dspProcessor.reset();
  }

  /**
   * Extrai a fatia exata de áudio para o instante t e calcula a FFT + CQT + impacto
   */
  public getFrame(time: number): AudioAnalysisFrame {
    const currentSample = Math.floor(time * this.sampleRate);
    const slice = new Float32Array(this.fftSize);
    const halfFft = this.fftSize >> 1;
    const startOffset = currentSample - halfFft;

    // Mixagem para mono da janela centralizada em t
    for (let i = 0; i < this.fftSize; i++) {
      const sampleIdx = startOffset + i;
      if (sampleIdx >= 0 && sampleIdx < this.totalSamples) {
        let monoSum = 0;
        for (let c = 0; c < this.channels; c++) {
          monoSum += this.channelPointers[c][sampleIdx];
        }
        slice[i] = monoSum / this.channels;
      } else {
        slice[i] = 0;
      }
    }

    // Processamento matemático de sinal (Hann window, Cooley-Tukey Radix-2 FFT, CQT logarítmica, Spectral Tilt)
    const dspResult: DspResult = this.dspProcessor.process(slice);

    return {
      time,
      spectrum: dspResult.spectrum,
      bassImpact: dspResult.bassKick,
      energy: dspResult.energy,
      cumulative: dspResult.cumulative,
      timeDomain: slice,
    };
  }

  public getDuration(): number {
    return this.duration;
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }
}
