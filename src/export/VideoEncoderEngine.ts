import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';

export type VideoFormat = 'mp4-vp9' | 'webm-vp9' | 'mp4-h264';

export interface VideoEncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  audioBuffer: AudioBuffer | null;
  sampleRate: number;
  format?: VideoFormat;
}

export interface FinalizeResult {
  blob: Blob;
  extension: 'mp4' | 'webm';
  mimeType: string;
}

export class VideoEncoderEngine {
  private config: VideoEncoderConfig;
  private format: VideoFormat;

  private mp4Muxer: Mp4Muxer<Mp4ArrayBufferTarget> | null = null;
  private mp4Target: Mp4ArrayBufferTarget | null = null;

  private webmMuxer: WebmMuxer<WebmArrayBufferTarget> | null = null;
  private webmTarget: WebmArrayBufferTarget | null = null;

  private videoEncoder: VideoEncoder | null = null;
  private audioEncoder: AudioEncoder | null = null;
  private lastError: Error | null = null;

  private frameCount: number = 0;

  constructor(config: VideoEncoderConfig) {
    this.config = config;
    this.format = config.format || 'mp4-vp9';
  }

  /**
   * Inicializa o Muxer (MP4 ou WebM) e o VideoEncoder (VP9 CPU Seguro ou H.264 GPU)
   */
  public async init(): Promise<void> {
    if (typeof VideoEncoder === 'undefined') {
      throw new Error(
        'A API WebCodecs (VideoEncoder) não é suportada por este navegador. Use Chrome, Edge ou Brave atualizados.'
      );
    }

    this.lastError = null;

    if (this.format === 'webm-vp9') {
      await this.initWebmVP9();
    } else if (this.format === 'mp4-vp9') {
      await this.initMp4VP9();
    } else {
      await this.initMp4H264();
    }
  }

  /**
   * Modo 1: WebM com VP9 (100% Processador / CPU - Zero dependência de placa de vídeo)
   */
  private async initWebmVP9(): Promise<void> {
    this.webmTarget = new WebmArrayBufferTarget();

    // Testa codec VP9 suportado pelo libvpx do Chromium
    const vp9Candidates = [
      'vp09.00.10.08',
      'vp09.00.40.08',
      'vp09.00.41.08',
      'vp8',
    ];

    let chosenCodec = 'vp09.00.10.08';
    for (const codec of vp9Candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.fps,
        });
        if (support.supported) {
          chosenCodec = codec;
          break;
        }
      } catch {}
    }

    const hasAudio = this.config.audioBuffer !== null && typeof AudioEncoder !== 'undefined';

    this.webmMuxer = new WebmMuxer({
      target: this.webmTarget,
      video: {
        codec: chosenCodec === 'vp8' ? 'V_VP8' : 'V_VP9',
        width: this.config.width,
        height: this.config.height,
        frameRate: this.config.fps,
      },
      audio: hasAudio
        ? {
            codec: 'A_OPUS',
            numberOfChannels: this.config.audioBuffer!.numberOfChannels,
            sampleRate: this.config.sampleRate,
          }
        : undefined,
    });

    if (hasAudio) {
      try {
        await this.encodeAudioOpus();
      } catch (err) {
        console.warn('Falha na codificação de áudio Opus:', err);
      }
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          this.webmMuxer?.addVideoChunk(chunk, meta);
        } catch (err: any) {
          this.lastError = err instanceof Error ? err : new Error(String(err));
        }
      },
      error: (e) => {
        console.error('Erro no VideoEncoder (VP9):', e);
        this.lastError = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.videoEncoder.configure({
      codec: chosenCodec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.fps,
      hardwareAcceleration: 'no-preference',
      alpha: 'discard',
      latencyMode: 'realtime',
      bitrateMode: 'variable',
    });
  }

  /**
   * Modo 2: MP4 com VP9 (100% CPU Seguro em contentor MP4 universal)
   */
  private async initMp4VP9(): Promise<void> {
    this.mp4Target = new Mp4ArrayBufferTarget();

    const vp9Candidates = [
      'vp09.00.10.08',
      'vp09.00.40.08',
      'vp09.00.41.08',
    ];

    let chosenCodec = 'vp09.00.10.08';
    for (const codec of vp9Candidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.fps,
        });
        if (support.supported) {
          chosenCodec = codec;
          break;
        }
      } catch {}
    }

    // Verifica se áudio AAC é suportado
    let hasAudio = false;
    let audioCodec: 'aac' | 'opus' = 'aac';

    if (this.config.audioBuffer !== null && typeof AudioEncoder !== 'undefined') {
      try {
        const aacSupport = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: this.config.sampleRate,
          numberOfChannels: this.config.audioBuffer.numberOfChannels,
          bitrate: 192_000,
        });
        if (aacSupport.supported) {
          hasAudio = true;
          audioCodec = 'aac';
        } else {
          const opusSupport = await AudioEncoder.isConfigSupported({
            codec: 'opus',
            sampleRate: this.config.sampleRate,
            numberOfChannels: this.config.audioBuffer.numberOfChannels,
            bitrate: 192_000,
          });
          if (opusSupport.supported) {
            hasAudio = true;
            audioCodec = 'opus';
          }
        }
      } catch {
        hasAudio = false;
      }
    }

    this.mp4Muxer = new Mp4Muxer({
      target: this.mp4Target,
      video: {
        codec: 'vp9',
        width: this.config.width,
        height: this.config.height,
        frameRate: this.config.fps,
      },
      audio: hasAudio
        ? {
            codec: audioCodec,
            numberOfChannels: this.config.audioBuffer!.numberOfChannels,
            sampleRate: this.config.sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'strict',
    });

    if (hasAudio) {
      try {
        if (audioCodec === 'aac') {
          await this.encodeAudioAac();
        } else {
          await this.encodeAudioOpusMp4();
        }
      } catch (err) {
        console.warn('Falha na codificação de áudio, prosseguindo sem áudio:', err);
      }
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          this.handleMp4VideoChunk(chunk, meta);
        } catch (err: any) {
          this.lastError = err instanceof Error ? err : new Error(String(err));
        }
      },
      error: (e) => {
        console.error('Erro no VideoEncoder (VP9 MP4):', e);
        this.lastError = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.videoEncoder.configure({
      codec: chosenCodec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.fps,
      hardwareAcceleration: 'no-preference',
      alpha: 'discard',
      latencyMode: 'realtime',
      bitrateMode: 'variable',
    });
  }

  /**
   * Modo 3: MP4 com H.264 / AVC (Requer suporte de aceleração por hardware GPU)
   */
  private async initMp4H264(): Promise<void> {
    this.mp4Target = new Mp4ArrayBufferTarget();

    const candidateCodecs = [
      'avc1.4d002a', // Main Profile Level 4.2
      'avc1.420028', // Baseline Profile Level 4.0
      'avc1.42001f', // Baseline Profile Level 3.1
      'avc1.640028', // High Profile Level 4.0
    ];

    let chosenCodec = 'avc1.4d002a';
    for (const codec of candidateCodecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width: this.config.width,
          height: this.config.height,
          bitrate: this.config.bitrate,
          framerate: this.config.fps,
          hardwareAcceleration: 'no-preference',
        });
        if (support.supported) {
          chosenCodec = codec;
          break;
        }
      } catch {}
    }

    let hasAudio = false;
    if (this.config.audioBuffer !== null && typeof AudioEncoder !== 'undefined') {
      try {
        const aacSupport = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: this.config.sampleRate,
          numberOfChannels: this.config.audioBuffer.numberOfChannels,
          bitrate: 192_000,
        });
        hasAudio = !!aacSupport.supported;
      } catch {
        hasAudio = false;
      }
    }

    this.mp4Muxer = new Mp4Muxer({
      target: this.mp4Target,
      video: {
        codec: 'avc',
        width: this.config.width,
        height: this.config.height,
        frameRate: this.config.fps,
      },
      audio: hasAudio
        ? {
            codec: 'aac',
            numberOfChannels: this.config.audioBuffer!.numberOfChannels,
            sampleRate: this.config.sampleRate,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'strict',
    });

    if (hasAudio) {
      try {
        await this.encodeAudioAac();
      } catch (err) {
        console.warn('Falha na codificação de áudio AAC:', err);
      }
    }

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          this.handleMp4VideoChunk(chunk, meta);
        } catch (err: any) {
          this.lastError = err instanceof Error ? err : new Error(String(err));
        }
      },
      error: (e) => {
        console.error('Erro no VideoEncoder (H.264):', e);
        this.lastError = new Error(
          'O codificador H.264 por hardware falhou. Como o seu computador não possui placa de vídeo dedicada (GPU), selecione a opção "MP4 (VP9)" ou "WebM (VP9)" que roda 100% pelo processador (CPU) sem travamentos.'
        );
      },
    });

    this.videoEncoder.configure({
      codec: chosenCodec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.fps,
      hardwareAcceleration: 'no-preference',
      alpha: 'discard',
      latencyMode: 'realtime',
      bitrateMode: 'variable',
    });
  }

  /**
   * Codifica áudio em AAC para MP4
   */
  private async encodeAudioAac(): Promise<void> {
    const audioBuffer = this.config.audioBuffer!;
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = this.config.sampleRate;

    let encErr: Error | null = null;
    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        try {
          this.handleMp4AudioChunk(chunk, meta);
        } catch (err: any) {
          encErr = err;
        }
      },
      error: (e) => {
        encErr = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels: channels,
      bitrate: 192_000,
    });

    await this.pumpAudioFrames(audioBuffer, channels, sampleRate, () => encErr);
    await this.audioEncoder.flush();
  }

  /**
   * Codifica áudio em Opus para WebM
   */
  private async encodeAudioOpus(): Promise<void> {
    const audioBuffer = this.config.audioBuffer!;
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = this.config.sampleRate;

    let encErr: Error | null = null;
    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        try {
          this.webmMuxer?.addAudioChunk(chunk, meta);
        } catch (err: any) {
          encErr = err;
        }
      },
      error: (e) => {
        encErr = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.audioEncoder.configure({
      codec: 'opus',
      sampleRate,
      numberOfChannels: channels,
      bitrate: 192_000,
    });

    await this.pumpAudioFrames(audioBuffer, channels, sampleRate, () => encErr);
    await this.audioEncoder.flush();
  }

  /**
   * Codifica áudio em Opus para MP4
   */
  private async encodeAudioOpusMp4(): Promise<void> {
    const audioBuffer = this.config.audioBuffer!;
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = this.config.sampleRate;

    let encErr: Error | null = null;
    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        try {
          this.handleMp4AudioChunk(chunk, meta);
        } catch (err: any) {
          encErr = err;
        }
      },
      error: (e) => {
        encErr = e instanceof Error ? e : new Error(String(e));
      },
    });

    this.audioEncoder.configure({
      codec: 'opus',
      sampleRate,
      numberOfChannels: channels,
      bitrate: 192_000,
    });

    await this.pumpAudioFrames(audioBuffer, channels, sampleRate, () => encErr);
    await this.audioEncoder.flush();
  }

  private async pumpAudioFrames(
    audioBuffer: AudioBuffer,
    channels: number,
    sampleRate: number,
    getError: () => Error | null
  ): Promise<void> {
    const chunkSize = 1024;
    const totalFrames = audioBuffer.length;
    let offset = 0;

    while (offset < totalFrames) {
      const err = getError();
      if (err) throw err;

      const framesInChunk = Math.min(chunkSize, totalFrames - offset);
      const planarBuffer = new Float32Array(channels * framesInChunk);

      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const sub = channelData.subarray(offset, offset + framesInChunk);
        planarBuffer.set(sub, ch * framesInChunk);
      }

      const timestampMicros = Math.round((offset / sampleRate) * 1_000_000);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: framesInChunk,
        numberOfChannels: channels,
        timestamp: timestampMicros,
        data: planarBuffer,
      });

      this.audioEncoder!.encode(audioData);
      audioData.close();

      offset += framesInChunk;
    }
  }

  /**
   * Adiciona um chunk de vídeo codificado ao contentor MP4 com duração determinística garantida.
   * Evita a exceção 'addVideoChunkRaw duration must be a non-negative real number' do mp4-muxer.
   */
  private handleMp4VideoChunk(chunk: EncodedVideoChunk, meta?: any): void {
    if (!this.mp4Muxer) return;

    const frameDurationMicros = Math.round(1_000_000 / this.config.fps);
    const duration =
      typeof chunk.duration === 'number' && Number.isFinite(chunk.duration) && chunk.duration > 0
        ? chunk.duration
        : frameDurationMicros;

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    this.mp4Muxer.addVideoChunkRaw(
      data,
      chunk.type,
      chunk.timestamp,
      duration,
      meta
    );
  }

  /**
   * Adiciona um chunk de áudio codificado ao contentor MP4 com duração de fallback segura.
   */
  private handleMp4AudioChunk(chunk: EncodedAudioChunk, meta?: any): void {
    if (!this.mp4Muxer) return;

    const defaultAudioDurationMicros = Math.round((1024 / this.config.sampleRate) * 1_000_000);
    const duration =
      typeof chunk.duration === 'number' && Number.isFinite(chunk.duration) && chunk.duration > 0
        ? chunk.duration
        : defaultAudioDurationMicros;

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    this.mp4Muxer.addAudioChunkRaw(
      data,
      chunk.type,
      chunk.timestamp,
      duration,
      meta
    );
  }

  private checkError(): void {
    const err = this.lastError as Error | null;
    if (err) {
      throw new Error(err.message || String(err));
    }
  }

  /**
   * Captura uma frame diretamente do canvas WebGL e envia ao codificador
   */
  public async addVideoFrame(
    canvas: HTMLCanvasElement,
    timestampMicros: number,
    keyFrame: boolean
  ): Promise<void> {
    this.checkError();

    if (!this.videoEncoder || this.videoEncoder.state !== 'configured') {
      const err = this.lastError as Error | null;
      throw new Error(
        err
          ? err.message
          : 'O codificador de vídeo foi fechado pelo browser. Se o seu computador não possui placa de vídeo dedicada (GPU), selecione a opção "MP4 (VP9)" ou "WebM (VP9)".'
      );
    }

    // Regulação dinâmica de fila: permite pipeline assíncrono de até 6 frames sem estourar memória
    while (this.videoEncoder && this.videoEncoder.encodeQueueSize >= 6) {
      this.checkError();
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 8);
        if (this.videoEncoder) {
          this.videoEncoder.ondequeue = () => {
            clearTimeout(timer);
            if (this.videoEncoder) this.videoEncoder.ondequeue = null;
            resolve();
          };
        }
      });
    }

    this.checkError();

    const frameDurationMicros = Math.round(1_000_000 / this.config.fps);

    // Cria o VideoFrame garantindo as dimensões configuradas exatas e duração explícita
    const frame = new VideoFrame(canvas, {
      timestamp: timestampMicros,
      duration: frameDurationMicros,
      displayWidth: this.config.width,
      displayHeight: this.config.height,
    });

    try {
      this.videoEncoder.encode(frame, { keyFrame });
    } finally {
      frame.close();
    }

    this.frameCount++;
  }

  /**
   * Aborta e fecha com segurança qualquer codificador ativo
   */
  public abort(): void {
    try {
      if (this.videoEncoder && this.videoEncoder.state !== 'closed') {
        this.videoEncoder.close();
      }
    } catch {}
    this.videoEncoder = null;

    try {
      if (this.audioEncoder && this.audioEncoder.state !== 'closed') {
        this.audioEncoder.close();
      }
    } catch {}
    this.audioEncoder = null;
  }

  /**
   * Finaliza todos os streams e retorna o ficheiro pronto com a extensão correta
   */
  public async finalize(): Promise<FinalizeResult> {
    if (this.videoEncoder) {
      await this.videoEncoder.flush();
      this.videoEncoder.close();
      this.videoEncoder = null;
    }

    if (this.audioEncoder) {
      this.audioEncoder.close();
      this.audioEncoder = null;
    }

    if (this.format === 'webm-vp9') {
      if (!this.webmMuxer || !this.webmTarget) {
        throw new Error('WebM Muxer não inicializado.');
      }
      this.webmMuxer.finalize();
      const buffer = this.webmTarget.buffer;
      return {
        blob: new Blob([buffer], { type: 'video/webm' }),
        extension: 'webm',
        mimeType: 'video/webm',
      };
    } else {
      if (!this.mp4Muxer || !this.mp4Target) {
        throw new Error('MP4 Muxer não inicializado.');
      }
      this.mp4Muxer.finalize();
      const buffer = this.mp4Target.buffer;
      return {
        blob: new Blob([buffer], { type: 'video/mp4' }),
        extension: 'mp4',
        mimeType: 'video/mp4',
      };
    }
  }

  public getProcessedFrames(): number {
    return this.frameCount;
  }
}
