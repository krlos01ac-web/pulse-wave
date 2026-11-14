import { FboHybridRenderer } from '../render/FboHybridRenderer';
import { OfflineAudioAnalyzer } from '../dsp/OfflineAudioAnalyzer';
import { VideoEncoderEngine, type VideoFormat, type FinalizeResult } from './VideoEncoderEngine';
import type { CanvasKit, Canvas } from 'canvaskit-wasm';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  duration?: number;
  format?: VideoFormat;
}

export type DrawCallback = (
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  time: number,
  spectrum: Float32Array,
  bassImpact: number,
  cumulative: number,
  timeDomain?: Float32Array
) => void;

export type ProgressCallback = (
  progress: number,
  currentFrame: number,
  totalFrames: number,
  estimatedSecondsLeft: number
) => void;

export class DeterministicTimeline {
  private renderer: FboHybridRenderer;
  private canvas: HTMLCanvasElement;
  private isCancelled: boolean = false;

  constructor(renderer: FboHybridRenderer, canvas: HTMLCanvasElement) {
    this.renderer = renderer;
    this.canvas = canvas;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Executa a exportação determinística frame a frame a passos fixos de tempo (Δt = 1/fps)
   */
  public async exportVideo(
    audioBuffer: AudioBuffer,
    _sampleRate: number,
    options: ExportOptions,
    drawCallback: DrawCallback,
    onProgress?: ProgressCallback
  ): Promise<FinalizeResult> {
    this.isCancelled = false;

    const width = options.width;
    const height = options.height;
    const fps = options.fps;
    const bitrate = options.bitrate || 10_000_000; // 10 Mbps
    const duration = options.duration || audioBuffer.duration;
    const totalFrames = Math.max(1, Math.floor(duration * fps));

    // Guarda tamanho original para restaurar ao terminar
    const originalWidth = this.canvas.clientWidth || window.innerWidth;
    const originalHeight = this.canvas.clientHeight || window.innerHeight;

    // Redimensiona o renderizador para a resolução exata do vídeo exportado com pixelRatio = 1
    this.renderer.setSize(width, height, 1);

    // Inicializa o analisador determinístico offline de frequências FFT
    const offlineAnalyzer = new OfflineAudioAnalyzer(audioBuffer, 120, 2048);

    // Inicializa o motor de codificação WebCodecs
    const encoderEngine = new VideoEncoderEngine({
      width,
      height,
      fps,
      bitrate,
      audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      format: options.format,
    });

    await encoderEngine.init();

    const exportStartTime = performance.now();

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.isCancelled) {
          throw new Error('Exportação cancelada pelo utilizador.');
        }

        const t = frameIndex / fps;

        // 1. Extração determinística da FFT e espectro CQT para o instante t
        const audioFrame = offlineAnalyzer.getFrame(t);

        // 2. Renderização determinística no buffer gráfico (Skia + Three.js + Partículas)
        this.renderer.renderFrame(
          (ck, skCanvas, w, h, time) => {
            drawCallback(
              ck,
              skCanvas,
              w,
              h,
              time,
              audioFrame.spectrum,
              audioFrame.bassImpact,
              audioFrame.cumulative,
              audioFrame.timeDomain
            );
          },
          t,
          audioFrame.bassImpact,
          audioFrame.spectrum
        );

        // Garante que o desenho WebGL foi completado na GPU
        this.renderer.flush();

        // 4. Captura de frame da GPU e codificação por hardware
        const timestampMicros = Math.round(t * 1_000_000);
        const isKeyFrame = frameIndex % (fps * 2) === 0; // Keyframe a cada 2 segundos

        await encoderEngine.addVideoFrame(this.canvas, timestampMicros, isKeyFrame);

        // 5. Atualização de progresso e estimativa de tempo
        if (onProgress && (frameIndex % 5 === 0 || frameIndex === totalFrames - 1)) {
          const progress = (frameIndex + 1) / totalFrames;
          const elapsedSecs = (performance.now() - exportStartTime) * 0.001;
          const framesPerSec = (frameIndex + 1) / Math.max(0.1, elapsedSecs);
          const remainingFrames = totalFrames - (frameIndex + 1);
          const estimatedSecondsLeft = remainingFrames / Math.max(1, framesPerSec);

          onProgress(progress, frameIndex + 1, totalFrames, estimatedSecondsLeft);

          // Cede a thread para a UI atualizar o ecrã
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Finaliza o ficheiro de vídeo
      const exportResult = await encoderEngine.finalize();
      return exportResult;
    } catch (err) {
      encoderEngine.abort();
      throw err;
    } finally {
      // Restaura a resolução de visualização interativa com pixelRatio nativo
      this.renderer.setSize(originalWidth, originalHeight, Math.min(window.devicePixelRatio, 2));
    }
  }
}
