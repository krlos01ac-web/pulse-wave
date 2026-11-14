import type { VideoFormat } from '../export/VideoEncoderEngine';

export interface ExportModalOptions {
  onStartExport: (config: { width: number; height: number; fps: number; format: VideoFormat }) => void;
  onCancelExport: () => void;
}

export class ExportModalUi {
  private overlay: HTMLElement;
  private options: ExportModalOptions;

  private selectProfile!: HTMLSelectElement;
  private selectFormat!: HTMLSelectElement;
  private selectResolution!: HTMLSelectElement;
  private selectFps!: HTMLSelectElement;
  private btnStart!: HTMLButtonElement;
  private btnCancel!: HTMLButtonElement;

  private configSection!: HTMLElement;
  private progressSection!: HTMLElement;
  private progressFill!: HTMLElement;
  private progressText!: HTMLElement;
  private progressSubtext!: HTMLElement;

  constructor(options: ExportModalOptions) {
    this.options = options;

    this.overlay = document.createElement('div');
    this.overlay.id = 'export-modal-overlay';
    this.overlay.style.display = 'none';

    this.overlay.innerHTML = `
      <style>
        #export-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(4, 6, 14, 0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 99999;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #f0f4ff;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .export-card {
          width: min(90vw, 480px);
          background: #0f1322;
          border: 1px solid rgba(80, 140, 255, 0.3);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 180, 255, 0.15);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .export-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .export-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .export-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .export-label {
          font-size: 13px;
          font-weight: 500;
          color: #a0b4e0;
        }

        .export-select {
          background: #171d33;
          border: 1px solid rgba(80, 140, 255, 0.25);
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          outline: none;
          cursor: pointer;
        }

        .export-select:focus {
          border-color: #00d2ff;
          box-shadow: 0 0 10px rgba(0, 210, 255, 0.3);
        }

        .progress-bar-bg {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          overflow: hidden;
          margin-top: 10px;
        }

        .progress-bar-fill {
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #0077ff, #00d2ff);
          border-radius: 5px;
          box-shadow: 0 0 12px #00d2ff;
          transition: width 0.1s ease;
        }

        .btn-action-row {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 6px;
        }

        .btn-modal {
          padding: 11px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-modal-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ccc;
        }

        .btn-modal-cancel:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .btn-modal-start {
          background: linear-gradient(135deg, #00d2ff, #0055ff);
          border: none;
          color: #fff;
          box-shadow: 0 0 15px rgba(0, 180, 255, 0.45);
        }

        .btn-modal-start:hover {
          box-shadow: 0 0 25px rgba(0, 220, 255, 0.7);
          transform: translateY(-1px);
        }
      </style>

      <div class="export-card">
        <div class="export-header">
          <div class="export-title">
            <span>🎬</span> Exportar Vídeo (100% Local no Navegador)
          </div>
        </div>

        <div id="modal-config-section" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="export-field">
            <label class="export-label">⚡ Perfil de Desempenho / Velocidade</label>
            <select class="export-select" id="export-select-profile" style="border-color: #00d2ff; background: #131b2e; font-weight: 600;">
              <option value="turbo" selected>⚡ Modo Turbo Rápido (720p @ 30 FPS) - ~2 a 4 minutos (Recomendado)</option>
              <option value="balanced">⚖ Modo Equilibrado (1080p @ 30 FPS) - ~5 a 7 minutos</option>
              <option value="ultra">💎 Modo Ultra 60 FPS (1080p @ 60 FPS) - Mais demorado</option>
            </select>
          </div>

          <div class="export-field">
            <label class="export-label">Formato / Motor de Vídeo</label>
            <select class="export-select" id="export-select-format">
              <option value="mp4-vp9" selected>MP4 (VP9) - Modo CPU Seguro (Recomendado para PCs sem Placa de Vídeo)</option>
              <option value="webm-vp9">WebM (VP9) - Modo CPU Ultra Leve</option>
              <option value="mp4-h264">MP4 (H.264 / AVC) - Aceleração GPU (Requer placa gráfica dedicada)</option>
            </select>
          </div>

          <div class="export-field">
            <label class="export-label">Resolução de Saída</label>
            <select class="export-select" id="export-select-res">
              <option value="1280x720" selected>1280 x 720 (HD 720p - Recomendado: Renderização 2.5x mais rápida)</option>
              <option value="1920x1080">1920 x 1080 (Full HD 16:9 - YouTube / Ecrã)</option>
              <option value="1080x1080">1080 x 1080 (Quadrado 1:1 - Instagram / Feed)</option>
              <option value="1080x1920">1080 x 1920 (Vertical 9:16 - Reels / Shorts / TikTok)</option>
            </select>
          </div>

          <div class="export-field">
            <label class="export-label">Taxa de Fotogramas</label>
            <select class="export-select" id="export-select-fps">
              <option value="30" selected>30 FPS (Metade dos fotogramas - 2x Mais Rápido, Altamente Recomendado)</option>
              <option value="60">60 FPS (Ultra Fluido - 2x Mais Lento)</option>
            </select>
          </div>

          <p style="font-size: 12px; color: #8fa5d4; margin: 0; line-height: 1.5; background: rgba(0, 210, 255, 0.08); padding: 10px; border-radius: 8px; border: 1px solid rgba(0, 210, 255, 0.2);">
            🚀 <b>Otimizações Ativadas:</b> Codificação libvpx em <b>tempo real (real-time 1-pass)</b> com pipeline assíncrono. Em <b>30 FPS</b>, o vídeo processa metade dos fotogramas, reduzindo o tempo de horas para escassos minutos com excelente fluidez.
          </p>

          <div class="btn-action-row">
            <button class="btn-modal btn-modal-cancel" id="btn-modal-close">Fechar</button>
            <button class="btn-modal btn-modal-start" id="btn-modal-start">🚀 Iniciar Exportação</button>
          </div>
        </div>

        <div id="modal-progress-section" style="display: none; flex-direction: column; gap: 12px;">
          <div style="font-weight: 600; font-size: 15px; color: #00d2ff;" id="export-progress-text">
            A renderizar fotogramas... (0%)
          </div>

          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="export-progress-fill"></div>
          </div>

          <div style="font-size: 13px; color: #a0b4e0; display: flex; justify-content: space-between;" id="export-progress-subtext">
            <span>Fotograma 0 / 0</span>
            <span>A calcular tempo restante...</span>
          </div>

          <div class="btn-action-row" style="margin-top: 10px;">
            <button class="btn-modal btn-modal-cancel" id="btn-modal-cancel-export">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    this.configSection = this.overlay.querySelector('#modal-config-section')!;
    this.progressSection = this.overlay.querySelector('#modal-progress-section')!;
    this.selectProfile = this.overlay.querySelector('#export-select-profile')!;
    this.selectFormat = this.overlay.querySelector('#export-select-format')!;
    this.selectResolution = this.overlay.querySelector('#export-select-res')!;
    this.selectFps = this.overlay.querySelector('#export-select-fps')!;
    this.btnStart = this.overlay.querySelector('#btn-modal-start')!;
    this.btnCancel = this.overlay.querySelector('#btn-modal-close')!;
    this.progressFill = this.overlay.querySelector('#export-progress-fill')!;
    this.progressText = this.overlay.querySelector('#export-progress-text')!;
    this.progressSubtext = this.overlay.querySelector('#export-progress-subtext')!;

    this.attachEvents();
  }

  private attachEvents(): void {
    this.selectProfile.addEventListener('change', () => {
      const mode = this.selectProfile.value;
      if (mode === 'turbo') {
        this.selectResolution.value = '1280x720';
        this.selectFps.value = '30';
      } else if (mode === 'balanced') {
        this.selectResolution.value = '1920x1080';
        this.selectFps.value = '30';
      } else if (mode === 'ultra') {
        this.selectResolution.value = '1920x1080';
        this.selectFps.value = '60';
      }
    });
    this.btnCancel.addEventListener('click', () => {
      this.hide();
    });

    const cancelExportBtn = this.overlay.querySelector('#btn-modal-cancel-export')!;
    cancelExportBtn.addEventListener('click', () => {
      this.options.onCancelExport();
      this.hide();
    });

    this.btnStart.addEventListener('click', () => {
      const format = this.selectFormat.value as VideoFormat;
      const [wStr, hStr] = this.selectResolution.value.split('x');
      const width = parseInt(wStr, 10);
      const height = parseInt(hStr, 10);
      const fps = parseInt(this.selectFps.value, 10);

      this.configSection.style.display = 'none';
      this.progressSection.style.display = 'flex';

      this.options.onStartExport({ width, height, fps, format });
    });
  }

  public show(): void {
    this.configSection.style.display = 'flex';
    this.progressSection.style.display = 'none';
    this.progressFill.style.width = '0%';
    this.overlay.style.display = 'flex';
  }

  public hide(): void {
    this.overlay.style.display = 'none';
  }

  public updateProgress(progress: number, currentFrame: number, totalFrames: number, estimatedSecs: number): void {
    const pct = Math.floor(progress * 100);
    this.progressFill.style.width = `${pct}%`;
    this.progressText.innerText = `A renderizar fotogramas... (${pct}%)`;

    const mins = Math.floor(estimatedSecs / 60);
    const secs = Math.floor(estimatedSecs % 60);
    const timeLeftStr = estimatedSecs > 0 ? `~${mins > 0 ? `${mins}m ` : ''}${secs}s restantes` : 'A finalizar...';

    this.progressSubtext.innerHTML = `
      <span>Fotograma ${currentFrame} de ${totalFrames}</span>
      <span>${timeLeftStr}</span>
    `;
  }
}
