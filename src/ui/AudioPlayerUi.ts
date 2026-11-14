import { AudioEngine, type PlaybackInfo } from '../dsp/AudioEngine';

export class AudioPlayerUi {
  private container: HTMLElement;
  private audioEngine: AudioEngine;

  private playBtn!: HTMLButtonElement;
  private trackTitle!: HTMLElement;
  private timeDisplay!: HTMLElement;
  private progressBar!: HTMLInputElement;
  private volumeSlider!: HTMLInputElement;

  private isDraggingProgress: boolean = false;
  public onExportClick?: () => void;

  constructor(container: HTMLElement, audioEngine: AudioEngine) {
    this.container = container;
    this.audioEngine = audioEngine;
    this.createDom();
    this.attachEvents();
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private createDom(): void {
    const bar = document.createElement('div');
    bar.id = 'audio-control-bar';
    bar.innerHTML = `
      <style>
        #audio-control-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: min(92vw, 860px);
          background: rgba(12, 14, 24, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(80, 120, 200, 0.25);
          border-radius: 18px;
          padding: 14px 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 1000;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 200, 255, 0.12);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #e0e8ff;
          user-select: none;
        }

        .audio-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .audio-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .track-icon {
          font-size: 20px;
          filter: drop-shadow(0 0 8px rgba(0, 220, 255, 0.6));
        }

        .track-name {
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #ffffff;
        }

        .audio-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-ui {
          background: rgba(40, 60, 110, 0.45);
          border: 1px solid rgba(100, 160, 255, 0.35);
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .btn-ui:hover {
          background: rgba(60, 90, 160, 0.65);
          border-color: rgba(120, 200, 255, 0.7);
          box-shadow: 0 0 12px rgba(0, 180, 255, 0.3);
          transform: translateY(-1px);
        }

        .btn-play {
          background: linear-gradient(135deg, #00d2ff, #0066ff);
          border: none;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 0 18px rgba(0, 160, 255, 0.5);
          cursor: pointer;
          color: #fff;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .btn-play:hover {
          transform: scale(1.08);
          box-shadow: 0 0 25px rgba(0, 200, 255, 0.75);
        }

        .audio-progress-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .time-label {
          font-family: monospace;
          font-size: 12px;
          color: rgba(180, 205, 255, 0.85);
          min-width: 85px;
          text-align: right;
        }

        .slider-progress {
          flex: 1;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          outline: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .slider-progress::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00e5ff;
          box-shadow: 0 0 10px #00e5ff;
          cursor: pointer;
          transition: transform 0.1s;
        }

        .slider-progress::-webkit-slider-thumb:hover {
          transform: scale(1.3);
        }

        .volume-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .volume-slider {
          width: 70px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          outline: none;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
      </style>

      <div class="audio-top-row">
        <div class="audio-info">
          <span class="track-icon">🎵</span>
          <span class="track-name" id="ui-track-name">Nenhuma faixa carregada</span>
        </div>

        <div class="audio-actions">
          <input type="file" id="ui-file-input" accept="audio/*" style="display: none;" />
          <button class="btn-ui" id="ui-btn-load">
            <span>📁</span> Carregar Áudio
          </button>
          <button class="btn-ui" id="ui-btn-demo" style="background: rgba(120, 50, 180, 0.45); border-color: rgba(180, 100, 255, 0.4);">
            <span>⚡</span> Demo Synth
          </button>
          <button class="btn-ui" id="ui-btn-export" style="background: rgba(0, 160, 255, 0.25); border-color: rgba(0, 210, 255, 0.5); color: #66e5ff; font-weight: 600;">
            <span>🎬</span> Exportar MP4 (1080p)
          </button>
          <button class="btn-play" id="ui-btn-play" title="Play / Pause">
            ▶
          </button>
        </div>
      </div>

      <div class="audio-progress-row">
        <input type="range" class="slider-progress" id="ui-progress-bar" min="0" max="1000" value="0" />
        <span class="time-label" id="ui-time-display">00:00 / 00:00</span>
        <div class="volume-container">
          <span style="font-size: 13px;">🔊</span>
          <input type="range" class="volume-slider" id="ui-volume-slider" min="0" max="100" value="80" />
        </div>
      </div>
    `;

    this.container.appendChild(bar);

    this.playBtn = bar.querySelector('#ui-btn-play')!;
    this.trackTitle = bar.querySelector('#ui-track-name')!;
    this.timeDisplay = bar.querySelector('#ui-time-display')!;
    this.progressBar = bar.querySelector('#ui-progress-bar')!;
    this.volumeSlider = bar.querySelector('#ui-volume-slider')!;
  }

  private attachEvents(): void {
    const fileInput = document.getElementById('ui-file-input') as HTMLInputElement;
    const loadBtn = document.getElementById('ui-btn-load') as HTMLButtonElement;
    const demoBtn = document.getElementById('ui-btn-demo') as HTMLButtonElement;

    loadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.audioEngine.loadFile(target.files[0]);
      }
    });

    demoBtn.addEventListener('click', () => {
      this.audioEngine.generateDemoTrack();
    });

    const exportBtn = document.getElementById('ui-btn-export') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
      if (this.onExportClick) {
        this.onExportClick();
      }
    });

    this.playBtn.addEventListener('click', () => {
      this.audioEngine.togglePlay();
    });

    // Barra de progresso interativa
    this.progressBar.addEventListener('mousedown', () => {
      this.isDraggingProgress = true;
    });

    this.progressBar.addEventListener('input', () => {
      const val = Number(this.progressBar.value) / 1000;
      const info = this.audioEngine.getPlaybackInfo();
      this.timeDisplay.innerText = `${this.formatTime(val * info.duration)} / ${this.formatTime(info.duration)}`;
    });

    this.progressBar.addEventListener('change', () => {
      this.isDraggingProgress = false;
      const progress = Number(this.progressBar.value) / 1000;
      this.audioEngine.seek(progress);
    });

    // Controlo de Volume
    this.volumeSlider.addEventListener('input', () => {
      const vol = Number(this.volumeSlider.value) / 100;
      this.audioEngine.setVolume(vol);
    });

    // Callback de atualização de estado contínuo
    this.audioEngine.onPlaybackChange = (info: PlaybackInfo) => {
      this.updateUi(info);
    };
  }

  private updateUi(info: PlaybackInfo): void {
    this.playBtn.innerHTML = info.isPlaying ? '⏸' : '▶';
    this.trackTitle.innerText = info.trackName;
    this.timeDisplay.innerText = `${this.formatTime(info.currentTime)} / ${this.formatTime(info.duration)}`;

    if (!this.isDraggingProgress && info.duration > 0) {
      this.progressBar.value = Math.floor(info.progress * 1000).toString();
    }
  }
}
