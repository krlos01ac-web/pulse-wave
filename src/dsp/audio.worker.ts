import { DspProcessor, type DspResult } from './DspMath';

export interface WorkerInputMessage {
  type: 'process';
  samples: Float32Array;
  sampleRate: number;
  outputBands: number;
}

export interface WorkerOutputData extends DspResult {}

let dsp: DspProcessor | null = null;
let currentN = 0;
let currentSampleRate = 0;
let currentBands = 0;

self.onmessage = (e: MessageEvent<WorkerInputMessage>) => {
  const { samples, sampleRate, outputBands } = e.data;
  const n = samples.length;

  if (n < 64 || (n & (n - 1)) !== 0) return;

  if (!dsp || currentN !== n || currentSampleRate !== sampleRate || currentBands !== outputBands) {
    dsp = new DspProcessor(n, sampleRate, outputBands);
    currentN = n;
    currentSampleRate = sampleRate;
    currentBands = outputBands;
  }

  const result = dsp.process(samples);

  // Transferência do buffer sem cópias de memória (Zero-Copy Transferable)
  (self as any).postMessage(result, [result.spectrum.buffer]);
};
