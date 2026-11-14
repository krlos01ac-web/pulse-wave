import type { WorkerOutputData } from './audio.worker';

export interface PlaybackInfo {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number; // 0 a 1
  trackName: string;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  // Web Worker de DSP
  private dspWorker: Worker | null = null;

  // Estado de reprodução
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private duration: number = 0;
  private trackName: string = 'Nenhuma faixa carregada';
  private volume: number = 0.8;

  // Dados reativos de saída para o renderizador
  private latestSpectrum: Float32Array = new Float32Array(120);
  private latestBassKick: number = 0;
  private latestEnergy: number = 0;
  private cumulativeAudio: number = 0;

  // Configurações do DSP
  private fftSize: number = 2048;
  private timeDomainBuffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(2048 * 4));
  private outputBands: number = 120;
  private isProcessingWorker: boolean = false;

  // Callback de eventos
  public onPlaybackChange?: (info: PlaybackInfo) => void;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.dspWorker = new Worker(new URL('./audio.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.dspWorker.onmessage = (e: MessageEvent<WorkerOutputData>) => {
        this.isProcessingWorker = false;
        const data = e.data;
        if (data && data.spectrum) {
          this.latestSpectrum = new Float32Array(data.spectrum);
          this.latestBassKick = data.bassKick;
          this.latestEnergy = data.energy;
          this.cumulativeAudio = data.cumulative;
        }
      };

      this.dspWorker.onerror = (err) => {
        console.error('Erro no Worker DSP de áudio:', err);
        this.isProcessingWorker = false;
      };
    } catch (err) {
      console.warn('Falha ao iniciar Web Worker de áudio:', err);
    }
  }

  /**
   * Garante a inicialização do AudioContext sob ação do utilizador
   */
  private ensureAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.fftSize;
      this.analyserNode.smoothingTimeConstant = 0.0; // O smoothing fino é feito no Worker

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Carrega um ficheiro de áudio local (.mp3, .wav, .ogg, etc.)
   */
  public async loadFile(file: File): Promise<void> {
    const ctx = this.ensureAudioContext();
    this.pause();

    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    this.duration = this.audioBuffer.duration;
    this.pauseOffset = 0;
    this.trackName = file.name;

    this.notifyPlayback();
    this.play();
  }

  /**
   * Gera uma faixa eletrónica sintética procedural em memória para teste imediato
   * (Kick 4/4 a 128 BPM, sub-bass 808 e arpeggio melódico estéreo)
   */
  public async generateDemoTrack(): Promise<void> {
    const ctx = this.ensureAudioContext();
    this.pause();

    const bpm = 128;
    const totalBars = 8;
    const beatsPerBar = 4;
    const totalBeats = totalBars * beatsPerBar;
    const secondsPerBeat = 60 / bpm;
    const totalDuration = totalBeats * secondsPerBeat; // ~15 segundos
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(totalDuration * sampleRate);

    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    // Frequências para o arpeggio (escala menor natural: Lá, Dó, Ré, Mi, Sol)
    const arpNotes = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 659.25];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beat = t / secondsPerBeat;
      const beatFraction = beat % 1.0;

      // 1. Bumbo / Kick Sub-Bass (Pitch envelope decaindo de 150 Hz para 45 Hz)
      let kick = 0;
      if (beatFraction < 0.35) {
        const kickEnv = Math.exp(-beatFraction * 14);
        const kickFreq = 45 + 105 * Math.exp(-beatFraction * 28);
        kick = Math.sin(2 * Math.PI * kickFreq * beatFraction * secondsPerBeat) * kickEnv * 1.2;
      }

      // 2. Linha de Baixo Sub-Bass 808 contínua
      const bassNote = 55; // Lá fundamental (55 Hz)
      const bassEnv = 0.5 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t);
      const subBass = Math.sin(2 * Math.PI * bassNote * t) * bassEnv * 0.45;

      // 3. Arpeggio Melódico Rápido (16th notes)
      const sixteenth = Math.floor(beat * 4) % arpNotes.length;
      const noteFreq = arpNotes[sixteenth];
      const arpEnv = Math.exp(-(beat * 4 % 1.0) * 8);
      // Onda dente de serra suave
      const sawPhase = (t * noteFreq) % 1.0;
      const arp = (sawPhase * 2 - 1) * arpEnv * 0.25;

      // 4. Hi-Hat de ruído branco no contra-tempo (offbeat)
      let hihat = 0;
      const offbeatFraction = (beat + 0.5) % 1.0;
      if (offbeatFraction < 0.12) {
        const hatEnv = Math.exp(-offbeatFraction * 32);
        hihat = (Math.random() * 2 - 1) * hatEnv * 0.18;
      }

      const mixed = kick + subBass + arp;
      left[i] = Math.max(-1, Math.min(1, mixed + hihat * 0.8));
      right[i] = Math.max(-1, Math.min(1, mixed - hihat * 0.8));
    }

    this.audioBuffer = buffer;
    this.duration = totalDuration;
    this.pauseOffset = 0;
    this.trackName = '⚡ Procedural Synthwave (128 BPM Demo)';

    this.notifyPlayback();
    this.play();
  }

  public play(): void {
    if (this.isPlaying || !this.audioBuffer) return;
    const ctx = this.ensureAudioContext();

    this.sourceNode = ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = true; // Loop contínuo

    this.sourceNode.connect(this.gainNode!);

    this.startTime = ctx.currentTime - this.pauseOffset;
    this.sourceNode.start(0, this.pauseOffset % this.duration);
    this.isPlaying = true;

    this.notifyPlayback();
  }

  public pause(): void {
    if (!this.isPlaying || !this.sourceNode || !this.audioContext) return;

    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;

    this.pauseOffset = (this.audioContext.currentTime - this.startTime) % this.duration;
    this.isPlaying = false;

    this.notifyPlayback();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(progress: number): void {
    if (!this.audioBuffer) return;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseOffset = Math.max(0, Math.min(this.duration, progress * this.duration));
    if (wasPlaying) {
      this.play();
    } else {
      this.notifyPlayback();
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
  }

  /**
   * Chamado a cada frame do renderizador para alimentar o Web Worker com amostras PCM
   */
  public update(): void {
    if (!this.analyserNode || !this.dspWorker || !this.audioContext) return;

    // Extrai amostras PCM no domínio do tempo
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);

    // Se o worker estiver ocioso, envia o bloco de amostras
    if (!this.isProcessingWorker) {
      this.isProcessingWorker = true;
      // Cria cópia leve do buffer para envio
      const samplesCopy = new Float32Array(this.timeDomainBuffer);
      this.dspWorker.postMessage(
        {
          type: 'process',
          samples: samplesCopy,
          sampleRate: this.audioContext.sampleRate,
          outputBands: this.outputBands,
        },
        [samplesCopy.buffer as ArrayBuffer] // Zero-copy Transferable
      );
    }

    if (this.isPlaying) {
      this.notifyPlayback();
    }
  }

  private notifyPlayback(): void {
    if (this.onPlaybackChange) {
      const curTime = this.getCurrentTime();
      this.onPlaybackChange({
        isPlaying: this.isPlaying,
        currentTime: curTime,
        duration: this.duration,
        progress: this.duration > 0 ? curTime / this.duration : 0,
        trackName: this.trackName,
      });
    }
  }

  public getCurrentTime(): number {
    if (!this.audioContext || !this.audioBuffer) return 0;
    if (this.isPlaying) {
      return (this.audioContext.currentTime - this.startTime) % this.duration;
    }
    return this.pauseOffset;
  }

  public getSpectrum(): Float32Array {
    return this.latestSpectrum;
  }

  public getBassImpact(): number {
    return this.latestBassKick;
  }

  public getEnergy(): number {
    return this.latestEnergy;
  }

  public getCumulativeAudio(): number {
    return this.cumulativeAudio;
  }

  public getAudioBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  public getTimeDomain(): Float32Array {
    return this.timeDomainBuffer;
  }

  public getSampleRate(): number {
    return this.audioContext?.sampleRate || 44100;
  }

  public getTrackName(): string {
    return this.trackName;
  }

  public getPlaybackInfo(): PlaybackInfo {
    const curTime = this.getCurrentTime();
    return {
      isPlaying: this.isPlaying,
      currentTime: curTime,
      duration: this.duration,
      progress: this.duration > 0 ? curTime / this.duration : 0,
      trackName: this.trackName,
    };
  }
}
