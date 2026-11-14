import type { Composition } from '../engine/Composition';
import type { FboHybridRenderer } from '../render/FboHybridRenderer';
import { PRESETS } from '../engine/Presets';

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0,
  ];
}

export class EditorUi {
  private container: HTMLElement;
  private composition: Composition;
  private renderer: FboHybridRenderer;

  private topBar!: HTMLElement;
  private drawer!: HTMLElement;
  private isDrawerOpen: boolean = false;
  private activePresetKey: string = 'cyberpunk';

  public onImageUploaded?: (dataUrl: string) => void;

  constructor(container: HTMLElement, composition: Composition, renderer: FboHybridRenderer) {
    this.container = container;
    this.composition = composition;
    this.renderer = renderer;

    this.createDom();
    this.attachEvents();
  }

  private createDom(): void {
    const style = document.createElement('style');
    style.textContent = `
      #editor-top-bar {
        position: fixed;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        width: min(94vw, 1180px);
        background: rgba(10, 14, 26, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(80, 130, 220, 0.3);
        border-radius: 16px;
        padding: 10px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        z-index: 900;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 180, 255, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e0e8ff;
        user-select: none;
      }

      .editor-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.5px;
        color: #ffffff;
        text-shadow: 0 0 10px rgba(0, 210, 255, 0.6);
        cursor: default;
      }

      .brand-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #00e5ff;
        box-shadow: 0 0 10px #00e5ff;
        animation: pulseDot 2s infinite ease-in-out;
      }

      @keyframes pulseDot {
        0%, 100% { opacity: 0.6; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1.15); }
      }

      .preset-group {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(20, 28, 50, 0.6);
        padding: 4px;
        border-radius: 10px;
        border: 1px solid rgba(70, 100, 180, 0.25);
      }

      .preset-pill {
        background: transparent;
        border: none;
        color: #9ab0d8;
        padding: 5px 11px;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .preset-pill:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      .preset-pill.active {
        background: linear-gradient(135deg, #0088ff, #00d2ff);
        color: #ffffff;
        box-shadow: 0 2px 10px rgba(0, 150, 255, 0.4);
      }

      .layer-toggles-group {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .layer-toggle-btn {
        background: rgba(30, 45, 80, 0.45);
        border: 1px solid rgba(80, 120, 200, 0.3);
        color: #a0b8e6;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .layer-toggle-btn:hover {
        background: rgba(45, 70, 125, 0.65);
        color: #ffffff;
      }

      .layer-toggle-btn.active {
        border-color: #00d2ff;
        color: #ffffff;
        background: rgba(0, 180, 255, 0.25);
        box-shadow: 0 0 8px rgba(0, 210, 255, 0.3);
      }

      .editor-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .editor-btn {
        background: rgba(40, 60, 110, 0.5);
        border: 1px solid rgba(100, 160, 255, 0.35);
        color: #ffffff;
        border-radius: 9px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }

      .editor-btn:hover {
        background: rgba(60, 95, 175, 0.7);
        border-color: #00d2ff;
        box-shadow: 0 0 10px rgba(0, 200, 255, 0.25);
      }

      .editor-btn-primary {
        background: linear-gradient(135deg, #0051ff, #00c3ff);
        border: none;
        color: white;
      }

      .editor-btn-primary:hover {
        background: linear-gradient(135deg, #0066ff, #00d9ff);
        box-shadow: 0 0 14px rgba(0, 195, 255, 0.5);
      }

      /* Painel Lateral / Inspector Drawer */
      #editor-drawer {
        position: fixed;
        top: 0;
        right: -420px;
        width: 390px;
        height: 100vh;
        background: rgba(10, 13, 24, 0.94);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
        border-left: 1px solid rgba(80, 130, 220, 0.3);
        box-shadow: -15px 0 35px rgba(0, 0, 0, 0.7);
        z-index: 1050;
        display: flex;
        flex-direction: column;
        transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #d6e2ff;
      }

      #editor-drawer.open {
        right: 0;
      }

      .drawer-header {
        padding: 18px 22px;
        border-bottom: 1px solid rgba(80, 120, 200, 0.25);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(16, 22, 42, 0.6);
      }

      .drawer-title {
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .drawer-close {
        background: transparent;
        border: none;
        color: #8da4cf;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
      }

      .drawer-close:hover {
        color: #ff5577;
        background: rgba(255, 85, 119, 0.15);
      }

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .drawer-body::-webkit-scrollbar {
        width: 6px;
      }

      .drawer-body::-webkit-scrollbar-thumb {
        background: rgba(80, 120, 200, 0.3);
        border-radius: 3px;
      }

      .accordion-card {
        background: rgba(18, 25, 48, 0.55);
        border: 1px solid rgba(70, 110, 190, 0.22);
        border-radius: 12px;
        overflow: hidden;
        transition: border-color 0.2s;
      }

      .accordion-card:hover {
        border-color: rgba(90, 140, 230, 0.4);
      }

      .accordion-header {
        padding: 12px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 600;
        font-size: 13px;
        color: #e2edff;
        background: rgba(24, 34, 64, 0.4);
      }

      .accordion-header:hover {
        background: rgba(30, 44, 82, 0.6);
      }

      .accordion-content {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .control-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
      }

      .control-label {
        color: #a4badf;
        font-weight: 500;
      }

      .control-slider {
        flex: 1;
        max-width: 150px;
        accent-color: #00d2ff;
        cursor: pointer;
      }

      .control-val {
        font-family: monospace;
        font-size: 11px;
        color: #00e5ff;
        min-width: 38px;
        text-align: right;
      }

      .control-input {
        background: rgba(12, 17, 32, 0.8);
        border: 1px solid rgba(80, 120, 200, 0.35);
        color: #ffffff;
        border-radius: 6px;
        padding: 5px 8px;
        font-size: 12px;
        outline: none;
        flex: 1;
      }

      .control-input:focus {
        border-color: #00d2ff;
        box-shadow: 0 0 8px rgba(0, 210, 255, 0.3);
      }

      .control-color {
        width: 32px;
        height: 26px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
      }

      .control-checkbox {
        accent-color: #00d2ff;
        width: 16px;
        height: 16px;
        cursor: pointer;
      }

      .control-select {
        background: rgba(16, 23, 44, 0.9);
        border: 1px solid rgba(80, 120, 200, 0.35);
        color: #ffffff;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 12px;
        outline: none;
        cursor: pointer;
      }

      @media (max-width: 900px) {
        .layer-toggles-group {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);

    // 1. Cria a barra superior
    this.topBar = document.createElement('div');
    this.topBar.id = 'editor-top-bar';
    this.topBar.innerHTML = `
      <div class="editor-brand">
        <div class="brand-dot"></div>
        <span>VIZZY STUDIO</span>
      </div>

      <div class="preset-group" id="preset-buttons">
        <button class="preset-pill active" data-preset="cyberpunk">⚡ Cyberpunk</button>
        <button class="preset-pill" data-preset="synthwave">🌅 Synthwave</button>
        <button class="preset-pill" data-preset="minimalist">⚪ Minimal</button>
        <button class="preset-pill" data-preset="astral">🌌 Astral</button>
      </div>

      <div class="layer-toggles-group" id="layer-toggles">
        <button class="layer-toggle-btn active" data-layer="background-layer">🌌 Fundo</button>
        <button class="layer-toggle-btn active" data-layer="spectrum-ring-layer">⭕ Anel</button>
        <button class="layer-toggle-btn active" data-layer="spectrum-bars-layer">📊 Barras</button>
        <button class="layer-toggle-btn" data-layer="waveform-layer">〰️ Onda</button>
        <button class="layer-toggle-btn active" data-layer="image-logo-layer">💿 Capa</button>
        <button class="layer-toggle-btn active" data-layer="text-typography-layer">🔤 Texto</button>
      </div>

      <div class="editor-actions">
        <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
        <input type="file" id="project-upload-input" accept=".json" style="display: none;">

        <button class="editor-btn" id="btn-upload-image" title="Carregar Capa / Imagem do Álbum">
          <span>🖼️ Capa</span>
        </button>

        <button class="editor-btn" id="btn-save-project" title="Descarregar ficheiro JSON do Projeto">
          <span>💾 Salvar</span>
        </button>

        <button class="editor-btn" id="btn-load-project" title="Carregar ficheiro JSON do Projeto">
          <span>📂 Abrir</span>
        </button>

        <button class="editor-btn editor-btn-primary" id="btn-toggle-drawer">
          <span>🎛️ Camadas</span>
        </button>
      </div>
    `;
    this.container.appendChild(this.topBar);

    // 2. Cria o Drawer Lateral do Inspector
    this.drawer = document.createElement('div');
    this.drawer.id = 'editor-drawer';
    this.drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title">
          <span>🎛️ Inspetor de Camadas & Efeitos</span>
        </div>
        <button class="drawer-close" id="drawer-close-btn">✕</button>
      </div>

      <div class="drawer-body" id="drawer-body-content">
        <!-- Secção 1: Pós-Processamento 3D Three.js -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>✨ Pós-Processamento 3D (Three.js)</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Força do Bloom</span>
              <input type="range" class="control-slider" id="ctrl-bloom-strength" min="0" max="3.5" step="0.1" value="1.6">
              <span class="control-val" id="val-bloom-strength">1.6</span>
            </div>
            <div class="control-row">
              <span class="control-label">Raio do Bloom</span>
              <input type="range" class="control-slider" id="ctrl-bloom-radius" min="0" max="1" step="0.05" value="0.45">
              <span class="control-val" id="val-bloom-radius">0.45</span>
            </div>
            <div class="control-row">
              <span class="control-label">Aberração Cromática</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-chromatic" checked>
            </div>
            <div class="control-row">
              <span class="control-label">Nuvem de Partículas 3D</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-particles" checked>
            </div>
          </div>
        </div>

        <!-- Secção 2: Anel Espectral CQT -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>⭕ Anel Espectral CQT</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Espessura do Traço</span>
              <input type="range" class="control-slider" id="ctrl-ring-stroke" min="1" max="15" step="1" value="5">
              <span class="control-val" id="val-ring-stroke">5px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Deformação CQT</span>
              <input type="range" class="control-slider" id="ctrl-ring-deform" min="20" max="200" step="5" value="95">
              <span class="control-val" id="val-ring-deform">95</span>
            </div>
            <div class="control-row">
              <span class="control-label">Expansão no Bumbo (Kick)</span>
              <input type="range" class="control-slider" id="ctrl-ring-kick" min="0" max="80" step="2" value="42">
              <span class="control-val" id="val-ring-kick">42px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Cor Principal</span>
              <input type="color" class="control-color" id="ctrl-ring-color1" value="#00dcff">
            </div>
            <div class="control-row">
              <span class="control-label">Cor do Kick</span>
              <input type="color" class="control-color" id="ctrl-ring-color2" value="#ff28b4">
            </div>
            <div class="control-row">
              <span class="control-label">Onda de Choque</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-ring-shockwave" checked>
            </div>
          </div>
        </div>

        <!-- Secção 3: Barras de Espectro -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>📊 Barras de Espectro</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Contagem de Barras</span>
              <input type="range" class="control-slider" id="ctrl-bars-count" min="16" max="72" step="4" value="48">
              <span class="control-val" id="val-bars-count">48</span>
            </div>
            <div class="control-row">
              <span class="control-label">Altura Máxima</span>
              <input type="range" class="control-slider" id="ctrl-bars-height" min="30" max="220" step="5" value="110">
              <span class="control-val" id="val-bars-height">110px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Cor Graves</span>
              <input type="color" class="control-color" id="ctrl-bars-color1" value="#00d2ff">
            </div>
            <div class="control-row">
              <span class="control-label">Cor Agudos</span>
              <input type="color" class="control-color" id="ctrl-bars-color2" value="#ff32aa">
            </div>
          </div>
        </div>

        <!-- Secção 4: Osciloscópio / Forma de Onda -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>〰️ Osciloscópio (Waveform)</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Ativo</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-wave-active">
            </div>
            <div class="control-row">
              <span class="control-label">Amplitude</span>
              <input type="range" class="control-slider" id="ctrl-wave-amp" min="15" max="150" step="5" value="60">
              <span class="control-val" id="val-wave-amp">60</span>
            </div>
            <div class="control-row">
              <span class="control-label">Espessura</span>
              <input type="range" class="control-slider" id="ctrl-wave-stroke" min="1" max="8" step="1" value="3">
              <span class="control-val" id="val-wave-stroke">3px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Posição Vertical (Y)</span>
              <input type="range" class="control-slider" id="ctrl-wave-posy" min="-150" max="150" step="5" value="-35">
              <span class="control-val" id="val-wave-posy">-35</span>
            </div>
            <div class="control-row">
              <span class="control-label">Cor da Onda</span>
              <input type="color" class="control-color" id="ctrl-wave-color" value="#00ffb4">
            </div>
          </div>
        </div>

        <!-- Secção 5: Capa / Disco de Vinil -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>💿 Capa / Disco de Vinil</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Raio Central</span>
              <input type="range" class="control-slider" id="ctrl-logo-radius" min="40" max="140" step="5" value="80">
              <span class="control-val" id="val-logo-radius">80px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Rotação Automática</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-logo-rotate" checked>
            </div>
            <div class="control-row">
              <span class="control-label">Velocidade Rotação</span>
              <input type="range" class="control-slider" id="ctrl-logo-speed" min="-1.5" max="1.5" step="0.1" value="0.3">
              <span class="control-val" id="val-logo-speed">0.3</span>
            </div>
            <div class="control-row">
              <span class="control-label">Cor da Borda</span>
              <input type="color" class="control-color" id="ctrl-logo-bordercolor" value="#00dcff">
            </div>
          </div>
        </div>

        <!-- Secção 6: Tipografia -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>🔤 Tipografia & Textos</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Título</span>
              <input type="text" class="control-input" id="ctrl-text-title" value="NEON CYBERPUNK">
            </div>
            <div class="control-row">
              <span class="control-label">Subtítulo</span>
              <input type="text" class="control-input" id="ctrl-text-sub" value="CQT DSP MODULAR ENGINE">
            </div>
            <div class="control-row">
              <span class="control-label">Tamanho Título</span>
              <input type="range" class="control-slider" id="ctrl-text-titlesize" min="16" max="42" step="1" value="26">
              <span class="control-val" id="val-text-titlesize">26px</span>
            </div>
            <div class="control-row">
              <span class="control-label">Reação ao Bumbo</span>
              <input type="checkbox" class="control-checkbox" id="ctrl-text-bounce" checked>
            </div>
          </div>
        </div>

        <!-- Secção 7: Plano de Fundo -->
        <div class="accordion-card">
          <div class="accordion-header">
            <span>🌌 Plano de Fundo</span>
            <span>▼</span>
          </div>
          <div class="accordion-content">
            <div class="control-row">
              <span class="control-label">Estilo</span>
              <select class="control-select" id="ctrl-bg-style">
                <option value="grid" selected>Grelha Holográfica</option>
                <option value="gradient">Gradiente Radial</option>
                <option value="starfield">Campo Estelar (Warp)</option>
              </select>
            </div>
            <div class="control-row">
              <span class="control-label">Reatividade ao Som</span>
              <input type="range" class="control-slider" id="ctrl-bg-react" min="0" max="2.5" step="0.1" value="1.2">
              <span class="control-val" id="val-bg-react">1.2</span>
            </div>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(this.drawer);
  }

  private attachEvents(): void {
    // 1. Alternador do Drawer lateral
    const btnToggle = this.topBar.querySelector('#btn-toggle-drawer') as HTMLButtonElement;
    const btnClose = this.drawer.querySelector('#drawer-close-btn') as HTMLButtonElement;

    btnToggle.addEventListener('click', () => {
      this.isDrawerOpen = !this.isDrawerOpen;
      this.drawer.classList.toggle('open', this.isDrawerOpen);
    });

    btnClose.addEventListener('click', () => {
      this.isDrawerOpen = false;
      this.drawer.classList.remove('open');
    });

    // 2. Botões de Presets Rápidos
    const presetBtns = this.topBar.querySelectorAll('.preset-pill');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const key = target.dataset.preset;
        if (!key) return;

        this.applyPreset(key);
      });
    });

    // 3. Toggles rápidos de Camadas no Top Bar
    const layerToggles = this.topBar.querySelectorAll('.layer-toggle-btn');
    layerToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const layerId = target.dataset.layer;
        if (!layerId) return;

        const layer = this.composition.getLayer(layerId);
        if (layer) {
          layer.enabled = !layer.enabled;
          target.classList.toggle('active', layer.enabled);
          this.syncDrawerInputsFromLayer(layerId);
        }
      });
    });

    // 4. Upload de Capa / Imagem de Álbum
    const btnUploadImg = this.topBar.querySelector('#btn-upload-image') as HTMLButtonElement;
    const fileImgInput = this.topBar.querySelector('#image-upload-input') as HTMLInputElement;

    btnUploadImg.addEventListener('click', () => fileImgInput.click());
    fileImgInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const ck = this.renderer.getCanvasKit();
          this.composition.imageLogo.setImageFromDataUrl(dataUrl, ck);
          if (this.onImageUploaded) {
            this.onImageUploaded(dataUrl);
          }
        }
      };
      reader.readAsDataURL(file);
    });

    // 5. Salvar e Carregar Projeto JSON
    const btnSave = this.topBar.querySelector('#btn-save-project') as HTMLButtonElement;
    const btnLoad = this.topBar.querySelector('#btn-load-project') as HTMLButtonElement;
    const projectFileInput = this.topBar.querySelector('#project-upload-input') as HTMLInputElement;

    btnSave.addEventListener('click', () => {
      const json = this.composition.exportState();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vizzy_project_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    btnLoad.addEventListener('click', () => projectFileInput.click());
    projectFileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        if (json) {
          this.composition.importState(json);
          this.syncAllInputs();
        }
      };
      reader.readAsText(file);
    });

    // 6. Configurações interativas no Drawer
    this.bindDrawerControls();
  }

  private bindDrawerControls(): void {
    // Helper para slider com visor numérico
    const bindSlider = (id: string, valId: string, suffix: string, onChange: (val: number) => void) => {
      const slider = this.drawer.querySelector(`#${id}`) as HTMLInputElement;
      const display = this.drawer.querySelector(`#${valId}`) as HTMLElement;
      if (!slider || !display) return;

      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        display.innerText = `${slider.value}${suffix}`;
        onChange(val);
      });
    };

    // Pós-Processamento Three.js
    bindSlider('ctrl-bloom-strength', 'val-bloom-strength', '', (v) => {
      this.renderer.setBloomConfig(v, parseFloat((this.drawer.querySelector('#ctrl-bloom-radius') as HTMLInputElement).value), 0.15);
    });

    bindSlider('ctrl-bloom-radius', 'val-bloom-radius', '', (v) => {
      this.renderer.setBloomConfig(parseFloat((this.drawer.querySelector('#ctrl-bloom-strength') as HTMLInputElement).value), v, 0.15);
    });

    const chkChromatic = this.drawer.querySelector('#ctrl-chromatic') as HTMLInputElement;
    chkChromatic.addEventListener('change', () => {
      this.renderer.chromaticAberrationEnabled = chkChromatic.checked;
    });

    const chkParticles = this.drawer.querySelector('#ctrl-particles') as HTMLInputElement;
    chkParticles.addEventListener('change', () => {
      this.renderer.particlesEnabled = chkParticles.checked;
    });

    // Anel CQT
    bindSlider('ctrl-ring-stroke', 'val-ring-stroke', 'px', (v) => {
      this.composition.spectrumRing.strokeWidth = v;
    });
    bindSlider('ctrl-ring-deform', 'val-ring-deform', '', (v) => {
      this.composition.spectrumRing.deformationScale = v;
    });
    bindSlider('ctrl-ring-kick', 'val-ring-kick', 'px', (v) => {
      this.composition.spectrumRing.kickExpansion = v;
    });

    const ringCol1 = this.drawer.querySelector('#ctrl-ring-color1') as HTMLInputElement;
    ringCol1.addEventListener('input', () => {
      this.composition.spectrumRing.primaryColor = hexToRgb(ringCol1.value);
    });
    const ringCol2 = this.drawer.querySelector('#ctrl-ring-color2') as HTMLInputElement;
    ringCol2.addEventListener('input', () => {
      this.composition.spectrumRing.kickColor = hexToRgb(ringCol2.value);
    });
    const ringShock = this.drawer.querySelector('#ctrl-ring-shockwave') as HTMLInputElement;
    ringShock.addEventListener('change', () => {
      this.composition.spectrumRing.shockwaveEnabled = ringShock.checked;
    });

    // Barras
    bindSlider('ctrl-bars-count', 'val-bars-count', '', (v) => {
      this.composition.spectrumBars.barCount = Math.round(v);
    });
    bindSlider('ctrl-bars-height', 'val-bars-height', 'px', (v) => {
      this.composition.spectrumBars.maxHeight = v;
    });
    const barsCol1 = this.drawer.querySelector('#ctrl-bars-color1') as HTMLInputElement;
    barsCol1.addEventListener('input', () => {
      this.composition.spectrumBars.colorLow = hexToRgb(barsCol1.value);
    });
    const barsCol2 = this.drawer.querySelector('#ctrl-bars-color2') as HTMLInputElement;
    barsCol2.addEventListener('input', () => {
      this.composition.spectrumBars.colorHigh = hexToRgb(barsCol2.value);
    });

    // Waveform
    const waveActive = this.drawer.querySelector('#ctrl-wave-active') as HTMLInputElement;
    waveActive.addEventListener('change', () => {
      this.composition.waveform.enabled = waveActive.checked;
      const toggle = this.topBar.querySelector('[data-layer="waveform-layer"]');
      if (toggle) toggle.classList.toggle('active', waveActive.checked);
    });
    bindSlider('ctrl-wave-amp', 'val-wave-amp', '', (v) => {
      this.composition.waveform.amplitude = v;
    });
    bindSlider('ctrl-wave-stroke', 'val-wave-stroke', 'px', (v) => {
      this.composition.waveform.strokeWidth = v;
    });
    bindSlider('ctrl-wave-posy', 'val-wave-posy', '', (v) => {
      this.composition.waveform.positionYOffset = v;
    });
    const waveCol = this.drawer.querySelector('#ctrl-wave-color') as HTMLInputElement;
    waveCol.addEventListener('input', () => {
      this.composition.waveform.color = hexToRgb(waveCol.value);
    });

    // Capa / Logo
    bindSlider('ctrl-logo-radius', 'val-logo-radius', 'px', (v) => {
      this.composition.imageLogo.radius = v;
    });
    const logoRot = this.drawer.querySelector('#ctrl-logo-rotate') as HTMLInputElement;
    logoRot.addEventListener('change', () => {
      this.composition.imageLogo.autoRotate = logoRot.checked;
    });
    bindSlider('ctrl-logo-speed', 'val-logo-speed', '', (v) => {
      this.composition.imageLogo.rotationSpeed = v;
    });
    const logoBorderCol = this.drawer.querySelector('#ctrl-logo-bordercolor') as HTMLInputElement;
    logoBorderCol.addEventListener('input', () => {
      this.composition.imageLogo.borderColor = hexToRgb(logoBorderCol.value);
    });

    // Tipografia
    const txtTitle = this.drawer.querySelector('#ctrl-text-title') as HTMLInputElement;
    txtTitle.addEventListener('input', () => {
      this.composition.textTypography.title = txtTitle.value;
    });
    const txtSub = this.drawer.querySelector('#ctrl-text-sub') as HTMLInputElement;
    txtSub.addEventListener('input', () => {
      this.composition.textTypography.subtitle = txtSub.value;
    });
    bindSlider('ctrl-text-titlesize', 'val-text-titlesize', 'px', (v) => {
      this.composition.textTypography.titleSize = Math.round(v);
    });
    const txtBounce = this.drawer.querySelector('#ctrl-text-bounce') as HTMLInputElement;
    txtBounce.addEventListener('change', () => {
      this.composition.textTypography.bounceOnKick = txtBounce.checked;
    });

    // Fundo
    const bgStyle = this.drawer.querySelector('#ctrl-bg-style') as HTMLSelectElement;
    bgStyle.addEventListener('change', () => {
      this.composition.background.style = bgStyle.value as 'grid' | 'gradient' | 'starfield';
    });
    bindSlider('ctrl-bg-react', 'val-bg-react', '', (v) => {
      this.composition.background.pulseReactivity = v;
    });
  }

  public applyPreset(key: string): void {
    const preset = PRESETS[key];
    if (!preset) return;

    this.activePresetKey = key;
    this.composition.applyPreset(key, this.renderer);

    // Atualiza pills da barra superior
    const pills = this.topBar.querySelectorAll('.preset-pill');
    pills.forEach((p) => {
      p.classList.toggle('active', (p as HTMLElement).dataset.preset === key);
    });

    this.syncAllInputs();
  }

  public getActivePresetKey(): string {
    return this.activePresetKey;
  }

  private syncDrawerInputsFromLayer(layerId: string): void {
    if (layerId === 'waveform-layer') {
      const chk = this.drawer.querySelector('#ctrl-wave-active') as HTMLInputElement;
      if (chk) chk.checked = this.composition.waveform.enabled;
    }
  }

  public syncAllInputs(): void {
    // Atualiza botões de camadas na barra superior
    const toggles = this.topBar.querySelectorAll('.layer-toggle-btn');
    toggles.forEach((btn) => {
      const id = (btn as HTMLElement).dataset.layer;
      if (!id) return;
      const layer = this.composition.getLayer(id);
      if (layer) {
        btn.classList.toggle('active', layer.enabled);
      }
    });

    // Atualiza inputs no Drawer
    const setVal = (id: string, val: any) => {
      const el = this.drawer.querySelector(`#${id}`) as HTMLInputElement;
      if (el) el.value = val.toString();
    };
    const setTxt = (id: string, txt: string) => {
      const el = this.drawer.querySelector(`#${id}`) as HTMLElement;
      if (el) el.innerText = txt;
    };
    const setChk = (id: string, chk: boolean) => {
      const el = this.drawer.querySelector(`#${id}`) as HTMLInputElement;
      if (el) el.checked = chk;
    };

    // Bloom & 3D
    setChk('ctrl-chromatic', this.renderer.chromaticAberrationEnabled);
    setChk('ctrl-particles', this.renderer.particlesEnabled);

    // Ring
    setVal('ctrl-ring-stroke', this.composition.spectrumRing.strokeWidth);
    setTxt('val-ring-stroke', `${this.composition.spectrumRing.strokeWidth}px`);
    setVal('ctrl-ring-deform', this.composition.spectrumRing.deformationScale);
    setTxt('val-ring-deform', `${this.composition.spectrumRing.deformationScale}`);
    setVal('ctrl-ring-kick', this.composition.spectrumRing.kickExpansion);
    setTxt('val-ring-kick', `${this.composition.spectrumRing.kickExpansion}px`);
    setVal('ctrl-ring-color1', rgbToHex(...this.composition.spectrumRing.primaryColor));
    setVal('ctrl-ring-color2', rgbToHex(...this.composition.spectrumRing.kickColor));
    setChk('ctrl-ring-shockwave', this.composition.spectrumRing.shockwaveEnabled);

    // Bars
    setVal('ctrl-bars-count', this.composition.spectrumBars.barCount);
    setTxt('val-bars-count', `${this.composition.spectrumBars.barCount}`);
    setVal('ctrl-bars-height', this.composition.spectrumBars.maxHeight);
    setTxt('val-bars-height', `${this.composition.spectrumBars.maxHeight}px`);
    setVal('ctrl-bars-color1', rgbToHex(...this.composition.spectrumBars.colorLow));
    setVal('ctrl-bars-color2', rgbToHex(...this.composition.spectrumBars.colorHigh));

    // Waveform
    setChk('ctrl-wave-active', this.composition.waveform.enabled);
    setVal('ctrl-wave-amp', this.composition.waveform.amplitude);
    setTxt('val-wave-amp', `${this.composition.waveform.amplitude}`);
    setVal('ctrl-wave-stroke', this.composition.waveform.strokeWidth);
    setTxt('val-wave-stroke', `${this.composition.waveform.strokeWidth}px`);
    setVal('ctrl-wave-posy', this.composition.waveform.positionYOffset);
    setTxt('val-wave-posy', `${this.composition.waveform.positionYOffset}`);
    setVal('ctrl-wave-color', rgbToHex(...this.composition.waveform.color));

    // Logo
    setVal('ctrl-logo-radius', this.composition.imageLogo.radius);
    setTxt('val-logo-radius', `${this.composition.imageLogo.radius}px`);
    setChk('ctrl-logo-rotate', this.composition.imageLogo.autoRotate);
    setVal('ctrl-logo-speed', this.composition.imageLogo.rotationSpeed);
    setTxt('val-logo-speed', `${this.composition.imageLogo.rotationSpeed}`);
    setVal('ctrl-logo-bordercolor', rgbToHex(...this.composition.imageLogo.borderColor));

    // Text
    setVal('ctrl-text-title', this.composition.textTypography.title);
    setVal('ctrl-text-sub', this.composition.textTypography.subtitle);
    setVal('ctrl-text-titlesize', this.composition.textTypography.titleSize);
    setTxt('val-text-titlesize', `${this.composition.textTypography.titleSize}px`);
    setChk('ctrl-text-bounce', this.composition.textTypography.bounceOnKick);

    // BG
    const bgSel = this.drawer.querySelector('#ctrl-bg-style') as HTMLSelectElement;
    if (bgSel) bgSel.value = this.composition.background.style;
    setVal('ctrl-bg-react', this.composition.background.pulseReactivity);
    setTxt('val-bg-react', `${this.composition.background.pulseReactivity}`);
  }
}
