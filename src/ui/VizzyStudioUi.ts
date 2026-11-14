import type { Composition } from '../engine/Composition';
import type { FboHybridRenderer } from '../render/FboHybridRenderer';
import type { AudioEngine } from '../dsp/AudioEngine';
import type { BaseLayer } from '../render/layers/BaseLayer';
import type { ParticleShape, ParticleMovementStyle } from '../render/ParticleEngine';
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

/**
 * Gera uma imagem de cena noturna urbana cyberpunk (edifícios néon, asfalto molhado e carro)
 * para servir de fundo inicial idêntico ao do editor do Vizzy.io
 */
function generateCyberpunkCity(): string {
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext('2d')!;

  // Céu noturno escuro com névoa roxa/azul
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 720);
  skyGrad.addColorStop(0, '#060814');
  skyGrad.addColorStop(0.45, '#120b28');
  skyGrad.addColorStop(0.75, '#221040');
  skyGrad.addColorStop(1, '#090614');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1280, 720);

  // Edifícios e arranha-céus futuristas
  const buildings = [
    { x: 30, w: 90, h: 420 },
    { x: 130, w: 110, h: 480 },
    { x: 250, w: 140, h: 560 },
    { x: 400, w: 120, h: 510 },
    { x: 530, w: 170, h: 600 },
    { x: 710, w: 140, h: 540 },
    { x: 860, w: 130, h: 480 },
    { x: 1000, w: 150, h: 420 },
    { x: 1160, w: 100, h: 380 },
  ];

  buildings.forEach((b) => {
    ctx.fillStyle = '#0a0d1c';
    ctx.fillRect(b.x, 720 - b.h, b.w, b.h);

    // Janelas néon
    for (let wy = 720 - b.h + 20; wy < 530; wy += 20) {
      for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 14) {
        if (Math.random() > 0.45) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 220, 255, 0.7)' : 'rgba(255, 40, 180, 0.7)';
          ctx.fillRect(wx, wy, 7, 11);
        }
      }
    }
  });

  // Rua molhada com reflexos
  const roadGrad = ctx.createLinearGradient(0, 520, 0, 720);
  roadGrad.addColorStop(0, '#0d1020');
  roadGrad.addColorStop(1, '#05060f');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(0, 520, 1280, 200);

  // Reflexos de néon no asfalto molhado
  for (let rx = 80; rx < 1200; rx += 110) {
    const refGrad = ctx.createLinearGradient(rx, 520, rx, 720);
    refGrad.addColorStop(0, Math.random() > 0.5 ? 'rgba(0, 210, 255, 0.35)' : 'rgba(255, 40, 160, 0.35)');
    refGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = refGrad;
    ctx.fillRect(rx - 30, 520, 60, 200);
  }

  // Carro desportivo / silhueta ao centro
  ctx.fillStyle = '#06070e';
  ctx.beginPath();
  ctx.ellipse(640, 570, 140, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Faróis traseiros vermelhos/néon do carro
  ctx.fillStyle = '#ff1144';
  ctx.shadowColor = '#ff1144';
  ctx.shadowBlur = 15;
  ctx.fillRect(570, 555, 35, 8);
  ctx.fillRect(675, 555, 35, 8);
  ctx.shadowBlur = 0;

  return c.toDataURL('image/jpeg', 0.88);
}

export type ActivityTab = 'composition' | 'analyzers' | 'effects' | 'automations' | 'media' | 'projects' | 'lyrics';

export class VizzyStudioUi {
  private container: HTMLElement;
  private composition: Composition;
  private renderer: FboHybridRenderer;
  private audioEngine: AudioEngine;
  private viewportCanvas: HTMLCanvasElement;

  private activeTab: ActivityTab = 'media';
  private selectedLayerId: string = 'background-layer';
  private isPlaying: boolean = false;
  private isLooping: boolean = true;
  private currentZoom: number = 1;

  // Galeria de imagens enviadas
  private uploadedImages: Array<{ id: string; name: string; url: string }> = [];
  private activeBgImageUrl: string | null = null;

  public onExportRequested?: () => void;
  public onImageUploaded?: (dataUrl: string) => void;

  // Elementos do DOM
  private appRoot!: HTMLElement;
  private subPanelContent!: HTMLElement;
  private inspectorBody!: HTMLElement;
  private inspectorHeaderTitle!: HTMLElement;
  private timeDisplay!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private trackTitleDisplay!: HTMLElement;
  private waveformCanvas!: HTMLCanvasElement;
  private playheadLine!: HTMLElement;
  private volumeSlider!: HTMLInputElement;
  private viewportWrapper!: HTMLElement;

  constructor(
    container: HTMLElement,
    composition: Composition,
    renderer: FboHybridRenderer,
    audioEngine: AudioEngine,
    viewportCanvas: HTMLCanvasElement
  ) {
    this.container = container;
    this.composition = composition;
    this.renderer = renderer;
    this.audioEngine = audioEngine;
    this.viewportCanvas = viewportCanvas;

    // Inicializa a imagem cyberpunk padrão no histórico de uploads e no plano de fundo
    const defaultImg = generateCyberpunkCity();
    this.uploadedImages.push({
      id: 'default-cyberpunk',
      name: 'Cyberpunk Street (Default)',
      url: defaultImg,
    });
    this.activeBgImageUrl = defaultImg;

    // Configura o fundo da Composição para usar o modo Imagem com a imagem gerada
    const ck = this.renderer.getCanvasKit();
    this.composition.background.setImageFromDataUrl(defaultImg, ck);
    this.composition.background.enabled = true;
    this.composition.background.style = 'image';
    this.composition.background.fitToScreen = true;
    this.composition.background.vignette = 0.25;

    // Configura as barras para serem magenta/rosa choque como no print do utilizador
    this.composition.spectrumBars.colorLow = [255, 30, 140];
    this.composition.spectrumBars.colorHigh = [255, 80, 200];
    this.composition.spectrumBars.barCount = 56;
    this.composition.spectrumBars.maxHeight = 130;

    // Anel central desativado por padrão para dar destaque total à imagem de fundo e barras inferiores
    this.composition.spectrumRing.enabled = false;
    this.composition.imageLogo.enabled = false;

    this.createDom();
    this.attachEvents();
    this.renderSubPanel();
    this.renderInspector();
  }

  public getViewportElement(): HTMLElement {
    return this.viewportWrapper;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }

  private createDom(): void {
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --vz-bg-root: #0a0c12;
        --vz-bg-header: #12141c;
        --vz-bg-sidebar: #0f1118;
        --vz-bg-panel: #141722;
        --vz-bg-panel-hover: #1c2030;
        --vz-bg-card: #181c2a;
        --vz-border: #212638;
        --vz-border-light: rgba(255, 255, 255, 0.08);
        --vz-text: #c0c8db;
        --vz-text-bright: #ffffff;
        --vz-text-muted: #6f7894;
        --vz-accent-cyan: #00d2ff;
        --vz-accent-purple: #7058ff;
        --vz-accent-pink: #ff3377;
        --vz-accent-gold: #ffbe3b;
        --vz-accent-green: #2ecc71;
        --vz-font-main: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      #vizzy-studio-root {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: var(--vz-bg-root);
        color: var(--vz-text);
        font-family: var(--vz-font-main);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
      }

      /* ==================== 1. TOP HEADER ==================== */
      .vz-header {
        height: 44px;
        background: var(--vz-bg-header);
        border-bottom: 1px solid var(--vz-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        z-index: 100;
      }

      .vz-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .vz-logo {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 800;
        font-size: 17px;
        letter-spacing: 1px;
        color: #ffffff;
        cursor: pointer;
      }

      .vz-logo-bars {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 18px;
      }

      .vz-logo-bar {
        width: 3px;
        background: linear-gradient(to top, #7058ff, #00d2ff);
        border-radius: 2px;
      }

      .vz-menu-items {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .vz-menu-btn {
        background: transparent;
        border: none;
        color: var(--vz-text);
        padding: 6px 10px;
        border-radius: 5px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }

      .vz-menu-btn:hover {
        background: var(--vz-border);
        color: #fff;
      }

      .vz-donate-btn {
        background: linear-gradient(135deg, #3a68ff, #00bfff);
        border: none;
        color: #fff;
        padding: 5px 14px;
        border-radius: 14px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 150, 255, 0.35);
      }

      .vz-header-center {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vz-release-badge {
        color: var(--vz-accent-gold);
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: default;
      }

      .vz-header-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .vz-project-title-input {
        background: transparent;
        border: 1px solid transparent;
        color: var(--vz-text-bright);
        font-size: 13px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 5px;
        outline: none;
        text-align: right;
        max-width: 140px;
      }

      .vz-project-title-input:hover,
      .vz-project-title-input:focus {
        border-color: var(--vz-border);
        background: rgba(255, 255, 255, 0.05);
      }

      .vz-saved-status {
        font-size: 12px;
        color: var(--vz-accent-gold);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .vz-btn-pill {
        background: #1e2233;
        border: 1px solid var(--vz-border);
        color: var(--vz-text-bright);
        padding: 5px 12px;
        border-radius: 14px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .vz-btn-pill:hover {
        background: #2a3048;
        border-color: #3d4668;
      }

      .vz-btn-explore {
        background: linear-gradient(135deg, #5b34da, #8e44ad);
        border: none;
        color: #ffffff;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(108, 92, 231, 0.4);
      }

      .vz-btn-export {
        background: linear-gradient(135deg, #0088ff, #00d2ff);
        border: none;
        color: #ffffff;
        font-weight: 700;
        box-shadow: 0 2px 12px rgba(0, 210, 255, 0.4);
      }

      .vz-icon-btn {
        background: transparent;
        border: none;
        color: var(--vz-text);
        padding: 6px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
      }

      .vz-icon-btn:hover {
        background: var(--vz-border);
        color: #ffffff;
      }

      /* ==================== 2. MAIN WORKSPACE ==================== */
      .vz-workspace {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      /* Leftmost Activity Bar */
      .vz-activity-bar {
        width: 72px;
        background: var(--vz-bg-sidebar);
        border-right: 1px solid var(--vz-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 0;
        gap: 4px;
      }

      .vz-activity-item {
        width: 62px;
        height: 56px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: transparent;
        border: none;
        color: var(--vz-text-muted);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        padding: 2px;
      }

      .vz-activity-item:hover {
        color: var(--vz-text-bright);
        background: rgba(255, 255, 255, 0.05);
      }

      .vz-activity-item.active {
        color: #ffffff;
        background: rgba(112, 88, 255, 0.18);
        border: 1px solid rgba(112, 88, 255, 0.4);
      }

      .vz-activity-icon {
        font-size: 18px;
      }

      .vz-activity-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }

      /* Secondary Left Drawer Panel */
      .vz-sub-panel {
        width: 240px;
        background: var(--vz-bg-panel);
        border-right: 1px solid var(--vz-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .vz-sub-panel-header {
        height: 42px;
        padding: 0 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--vz-border-light);
        font-size: 13px;
        font-weight: 700;
        color: var(--vz-text-bright);
      }

      .vz-sub-panel-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vz-action-icon-green {
        color: var(--vz-accent-green);
        font-size: 18px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
      }

      .vz-action-icon-green:hover {
        background: rgba(46, 204, 113, 0.2);
      }

      .vz-sub-panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .vz-tree-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 12px;
        color: var(--vz-text);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .vz-tree-item:hover {
        background: var(--vz-bg-panel-hover);
        color: #ffffff;
      }

      .vz-tree-item.selected {
        background: rgba(0, 210, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(0, 210, 255, 0.35);
      }

      .vz-tree-item-left {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .vz-tree-toggle {
        background: transparent;
        border: none;
        color: var(--vz-text-muted);
        cursor: pointer;
        padding: 2px;
        font-size: 12px;
      }

      .vz-tree-toggle.active {
        color: var(--vz-accent-cyan);
      }

      /* Gallery Grid for Media Tab */
      .vz-media-tabs {
        display: flex;
        gap: 4px;
        background: #0f121d;
        padding: 3px;
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .vz-media-tab-btn {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--vz-text-muted);
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .vz-media-tab-btn.active {
        background: #202638;
        color: #ffffff;
      }

      .vz-media-accordion-header {
        padding: 6px 4px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 600;
        color: var(--vz-text-bright);
        cursor: pointer;
      }

      .vz-media-gallery {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        padding: 4px 0 10px 0;
      }

      .vz-media-card {
        aspect-ratio: 16 / 9;
        background: #0d101a;
        border: 1px solid var(--vz-border);
        border-radius: 6px;
        overflow: hidden;
        position: relative;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .vz-media-card:hover {
        border-color: var(--vz-accent-cyan);
        transform: scale(1.02);
      }

      .vz-media-card.active {
        border: 2px solid var(--vz-accent-cyan);
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
      }

      .vz-media-card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .vz-media-upload-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border: 1px dashed #3a4568;
        background: rgba(30, 40, 65, 0.3);
        color: var(--vz-text-muted);
        font-size: 11px;
        gap: 4px;
      }

      .vz-media-upload-card:hover {
        border-color: var(--vz-accent-cyan);
        color: #ffffff;
      }

      /* Central Viewport Area */
      .vz-viewport-container {
        flex: 1;
        background: #08090d;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        padding: 16px;
      }

      .vz-viewport-monitor {
        position: relative;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
        background: #000000;
        border: 1px solid var(--vz-border);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 150, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .vz-viewport-monitor canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Floating Overlay Bar at Bottom of Monitor */
      .vz-monitor-toolbar {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(14, 17, 26, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--vz-border);
        border-radius: 20px;
        padding: 4px 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 50;
      }

      .vz-res-pills {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .vz-res-pill {
        background: transparent;
        border: none;
        color: var(--vz-text-muted);
        padding: 3px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }

      .vz-res-pill:hover {
        color: #ffffff;
      }

      .vz-res-pill.active {
        background: #252b3d;
        color: #ffffff;
      }

      .vz-monitor-icon-btn {
        background: transparent;
        border: none;
        color: var(--vz-text-muted);
        padding: 2px 4px;
        cursor: pointer;
        font-size: 13px;
        transition: color 0.15s;
      }

      .vz-monitor-icon-btn:hover {
        color: #ffffff;
      }

      /* Right Inspector Panel */
      .vz-inspector-panel {
        width: 335px;
        min-width: 330px;
        background: var(--vz-bg-panel);
        border-left: 1px solid var(--vz-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .vz-inspector-header {
        height: 42px;
        min-height: 42px;
        padding: 0 14px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--vz-border-light);
        font-size: 13px;
        font-weight: 600;
        color: var(--vz-text-bright);
        flex-shrink: 0;
      }

      .vz-inspector-body {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* Custom Modern Dark Scrollbar */
      .vz-inspector-body::-webkit-scrollbar,
      .vz-sub-panel-body::-webkit-scrollbar {
        width: 6px;
      }

      .vz-inspector-body::-webkit-scrollbar-track,
      .vz-sub-panel-body::-webkit-scrollbar-track {
        background: rgba(10, 12, 18, 0.5);
      }

      .vz-inspector-body::-webkit-scrollbar-thumb,
      .vz-sub-panel-body::-webkit-scrollbar-thumb {
        background: #252c42;
        border-radius: 4px;
      }

      .vz-inspector-body::-webkit-scrollbar-thumb:hover,
      .vz-sub-panel-body::-webkit-scrollbar-thumb:hover {
        background: var(--vz-accent-cyan);
      }

      .vz-accordion-section {
        background: var(--vz-bg-card);
        border: 1px solid var(--vz-border);
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
      }

      .vz-accordion-header {
        padding: 9px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: var(--vz-text-bright);
        background: rgba(255, 255, 255, 0.02);
        user-select: none;
      }

      .vz-accordion-header:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .vz-accordion-content {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        border-top: 1px solid var(--vz-border-light);
      }

      .vz-field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        min-height: 28px;
        flex-shrink: 0;
      }

      .vz-field-label {
        color: var(--vz-text);
        font-weight: 500;
        flex: 1;
        line-height: 1.3;
      }

      .vz-field-slider {
        flex: 1;
        max-width: 125px;
        accent-color: var(--vz-accent-cyan);
        cursor: pointer;
      }

      .vz-field-val {
        font-family: monospace;
        font-size: 11px;
        color: var(--vz-accent-cyan);
        min-width: 40px;
        text-align: right;
      }

      .vz-field-input {
        background: #0e111a;
        border: 1px solid var(--vz-border);
        color: #ffffff;
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 11px;
        outline: none;
        flex: 1;
      }

      .vz-field-input:focus {
        border-color: var(--vz-accent-cyan);
      }

      .vz-field-select {
        background: #0e111a;
        border: 1px solid var(--vz-border);
        color: #ffffff;
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 11px;
        outline: none;
        cursor: pointer;
      }

      .vz-field-color {
        width: 30px;
        height: 22px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: transparent;
      }

      .vz-field-checkbox {
        accent-color: var(--vz-accent-cyan);
        width: 15px;
        height: 15px;
        cursor: pointer;
      }

      /* ==================== 3. BOTTOM TIMELINE & DAW TRANSPORT ==================== */
      .vz-timeline-panel {
        height: 165px;
        background: var(--vz-bg-header);
        border-top: 1px solid var(--vz-border);
        display: flex;
        flex-direction: column;
      }

      /* Transport Top Bar */
      .vz-transport-bar {
        height: 42px;
        border-bottom: 1px solid var(--vz-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        gap: 14px;
      }

      .vz-transport-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .vz-tool-btn {
        background: transparent;
        border: none;
        color: var(--vz-text);
        padding: 4px 6px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .vz-tool-btn:hover {
        color: #fff;
        background: var(--vz-border);
      }

      .vz-tool-btn.active {
        color: var(--vz-accent-cyan);
      }

      .vz-timecode {
        font-family: monospace;
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        background: rgba(0, 0, 0, 0.4);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid var(--vz-border);
        letter-spacing: 0.5px;
      }

      .vz-transport-center {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vz-playback-btn {
        background: #1c2030;
        border: 1px solid var(--vz-border);
        color: #ffffff;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.15s ease;
      }

      .vz-playback-btn:hover {
        background: #282f48;
        border-color: #3d4668;
      }

      .vz-playback-btn.play-btn {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #0088ff, #00d2ff);
        border: none;
        font-size: 13px;
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
      }

      .vz-transport-right {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .vz-track-info {
        font-size: 12px;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .vz-btn-choose-audio {
        background: #1e2436;
        border: 1px solid var(--vz-border);
        color: #ffffff;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s;
      }

      .vz-btn-choose-audio:hover {
        background: #283048;
        border-color: var(--vz-accent-cyan);
      }

      .vz-volume-wrapper {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .vz-vol-slider {
        width: 80px;
        accent-color: var(--vz-accent-cyan);
        cursor: pointer;
      }

      /* Multi-track Timeline Area */
      .vz-tracks-area {
        flex: 1;
        position: relative;
        background: #0d0f17;
        overflow: hidden;
        cursor: crosshair;
        display: flex;
        flex-direction: column;
      }

      .vz-track-lane {
        position: relative;
        width: 100%;
        border-bottom: 1px solid var(--vz-border);
      }

      .vz-track-audio {
        height: 52px;
        background: #111420;
      }

      .vz-track-audio canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      .vz-track-image {
        height: 34px;
        background: rgba(90, 45, 130, 0.35);
        display: flex;
        align-items: center;
        padding: 0 16px;
        position: relative;
        border-left: 3px solid #b537f2;
      }

      .vz-track-particles {
        height: 34px;
        background: rgba(30, 45, 80, 0.3);
        display: flex;
        align-items: center;
        padding: 0 16px;
        position: relative;
        border-left: 3px solid #00d2ff;
      }

      .vz-track-label {
        font-size: 11px;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 5;
        font-weight: 600;
      }

      /* Scrubber Playhead Needle */
      .vz-playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 2px;
        background: #ff3377;
        pointer-events: none;
        z-index: 50;
        box-shadow: 0 0 6px rgba(255, 51, 119, 0.8);
      }

      .vz-playhead::after {
        content: '';
        position: absolute;
        top: 0;
        left: -4px;
        width: 10px;
        height: 10px;
        background: #ff3377;
        transform: rotate(45deg);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);

    // 1. Cria a estrutura completa de Studio
    this.appRoot = document.createElement('div');
    this.appRoot.id = 'vizzy-studio-root';
    this.appRoot.innerHTML = `
      <!-- TOP MENU BAR -->
      <header class="vz-header">
        <div class="vz-header-left">
          <div class="vz-logo" id="vz-logo">
            <img src="/favicon.png" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover;" alt="Pulse Wave" />
            <span style="font-weight: 800; letter-spacing: 0.8px; background: linear-gradient(90deg, #00d2ff, #a060ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">PULSE WAVE</span>
          </div>

          <div class="vz-menu-items">
            <button class="vz-menu-btn" id="menu-file">File</button>
            <button class="vz-menu-btn" id="menu-edit">Edit</button>
            <button class="vz-menu-btn" id="menu-project">Project</button>
            <button class="vz-menu-btn" id="menu-view">View</button>
            <button class="vz-menu-btn" id="menu-help">Help</button>
          </div>

          <button class="vz-donate-btn">Donate</button>
        </div>

        <div class="vz-header-center">
          <span class="vz-release-badge">⚡ Release 1.4</span>
        </div>

        <div class="vz-header-right">
          <input type="text" class="vz-project-title-input" id="vz-project-title" value="neon visualizer" spellcheck="false" />
          <div class="vz-saved-status">Saved: ⚠️</div>
          <button class="vz-btn-pill" id="btn-unlisted">Unlisted project</button>
          <button class="vz-btn-pill vz-btn-explore" id="btn-explore">Explore creations</button>
          <button class="vz-btn-pill vz-btn-export" id="btn-export-mp4">Export MP4</button>
          <button class="vz-icon-btn" title="Partilhar">🔗</button>
          <button class="vz-icon-btn" title="Notificações">🔔</button>
        </div>
      </header>

      <!-- MAIN WORKSPACE -->
      <main class="vz-workspace">
        <!-- 1. Leftmost Activity Bar Ribbon -->
        <nav class="vz-activity-bar">
          <button class="vz-activity-item" data-tab="composition">
            <span class="vz-activity-icon">🗂️</span>
            <span class="vz-activity-label">Composition</span>
          </button>
          <button class="vz-activity-item" data-tab="analyzers">
            <span class="vz-activity-icon">📊</span>
            <span class="vz-activity-label">Analyzers</span>
          </button>
          <button class="vz-activity-item" data-tab="effects">
            <span class="vz-activity-icon">✨</span>
            <span class="vz-activity-label">Effects</span>
          </button>
          <button class="vz-activity-item" data-tab="automations">
            <span class="vz-activity-icon">📈</span>
            <span class="vz-activity-label">Automations</span>
          </button>
          <button class="vz-activity-item active" data-tab="media">
            <span class="vz-activity-icon">📁</span>
            <span class="vz-activity-label">Media</span>
          </button>
          <button class="vz-activity-item" data-tab="projects">
            <span class="vz-activity-icon">💾</span>
            <span class="vz-activity-label">Projects</span>
          </button>
          <button class="vz-activity-item" data-tab="lyrics">
            <span class="vz-activity-icon">🔤</span>
            <span class="vz-activity-label">Lyrics</span>
          </button>
        </nav>

        <!-- 2. Sub-panel Contextual -->
        <aside class="vz-sub-panel">
          <div class="vz-sub-panel-header">
            <span id="sub-panel-title">Media</span>
            <div class="vz-sub-panel-actions">
              <span title="Modos de Camada">❖</span>
              <span class="vz-action-icon-green" id="btn-add-item" title="Carregar Nova Imagem / Áudio">+</span>
            </div>
          </div>
          <div class="vz-sub-panel-body" id="sub-panel-body">
            <!-- Renderizado dinamicamente -->
          </div>
        </aside>

        <!-- 3. Central Viewport / Canvas Player Monitor -->
        <section class="vz-viewport-container" id="vz-viewport-container">
          <div class="vz-viewport-monitor" id="vz-viewport-monitor">
            <!-- Canvas Three.js & Skia injetado aqui -->
            <div class="vz-monitor-toolbar">
              <button class="vz-monitor-icon-btn">•••</button>
              <div class="vz-res-pills">
                <button class="vz-res-pill" data-res="360">360</button>
                <button class="vz-res-pill" data-res="480">480</button>
                <button class="vz-res-pill" data-res="720">720</button>
                <button class="vz-res-pill active" data-res="1080">1080</button>
              </div>
              <button class="vz-monitor-icon-btn" title="Proporção">▢</button>
              <button class="vz-monitor-icon-btn" title="Grelha">🌐</button>
              <button class="vz-monitor-icon-btn" id="btn-fullscreen" title="Ecrã Completo">⛶</button>
            </div>
          </div>
        </section>

        <!-- 4. Right Inspector Panel -->
        <aside class="vz-inspector-panel">
          <div class="vz-inspector-header">
            <span id="inspector-title">Objects / Image</span>
          </div>
          <div class="vz-inspector-body" id="inspector-body">
            <!-- Accordion trees -->
          </div>
        </aside>
      </main>

      <!-- BOTTOM TIMELINE & DAW TRANSPORT -->
      <footer class="vz-timeline-panel">
        <!-- Transport Controls Bar -->
        <div class="vz-transport-bar">
          <div class="vz-transport-left">
            <button class="vz-tool-btn" id="btn-zoom">
              <span>🔍 Zoom: 1</span>
            </button>
            <button class="vz-tool-btn active" id="btn-loop" title="Loop Ativo">
              <span>🔁</span>
            </button>
            <button class="vz-tool-btn" title="Modo Curva">
              <span>📈</span>
            </button>
            <div class="vz-timecode" id="vz-timecode">00:00.00 / 00:00.00</div>
          </div>

          <div class="vz-transport-center">
            <button class="vz-playback-btn" id="btn-stop" title="Parar">■</button>
            <button class="vz-playback-btn" id="btn-prev" title="Início">◀◀</button>
            <button class="vz-playback-btn play-btn" id="btn-play" title="Reproduzir / Pausa">▶</button>
            <button class="vz-playback-btn" id="btn-next" title="Fim">▶▶</button>
          </div>

          <div class="vz-transport-right">
            <div class="vz-track-info" id="vz-track-info">
              <span>♪ Exyl & Dalux - Nice Logo (Vizzy Edit)</span>
            </div>
            <button class="vz-btn-choose-audio" id="btn-choose-audio">
              <span>📁 Choose audio</span>
            </button>
            <input type="file" id="audio-file-input" accept="audio/*" style="display: none;" />
            <input type="file" id="image-file-input" accept="image/*" style="display: none;" />
            <input type="file" id="logo-file-input" accept="image/*" style="display: none;" />
            <input type="file" id="particle-file-input" accept="image/*" style="display: none;" />
            <input type="file" id="project-file-input" accept=".json" style="display: none;" />

            <div class="vz-volume-wrapper">
              <span style="font-size: 14px;">🔊</span>
              <input type="range" class="vz-vol-slider" id="vz-volume" min="0" max="1" step="0.05" value="0.85" />
            </div>
          </div>
        </div>

        <!-- Multi-track Lanes (Waveform + Image + Particles) -->
        <div class="vz-tracks-area" id="vz-tracks-area">
          <div class="vz-playhead" id="vz-playhead"></div>

          <!-- Pista 1: Áudio Waveform Real -->
          <div class="vz-track-lane vz-track-audio" id="track-audio-lane">
            <canvas id="waveform-canvas"></canvas>
          </div>

          <!-- Pista 2: Camada de Imagem de Fundo (como no print) -->
          <div class="vz-track-lane vz-track-image" id="track-image-lane">
            <div class="vz-track-label">
              <span>❖ Image</span>
            </div>
          </div>

          <!-- Pista 3: Partículas 3D -->
          <div class="vz-track-lane vz-track-particles" id="track-particles-lane">
            <div class="vz-track-label">
              <span>❖ Particles</span>
            </div>
          </div>
        </div>
      </footer>
    `;

    this.container.appendChild(this.appRoot);

    // Injeta o canvas de renderização WebGL dentro do monitor central
    this.viewportWrapper = this.appRoot.querySelector('#vz-viewport-monitor') as HTMLElement;
    this.viewportWrapper.insertBefore(this.viewportCanvas, this.viewportWrapper.firstChild);

    // Mapeamento de referências DOM
    this.subPanelContent = this.appRoot.querySelector('#sub-panel-body') as HTMLElement;
    this.inspectorBody = this.appRoot.querySelector('#inspector-body') as HTMLElement;
    this.inspectorHeaderTitle = this.appRoot.querySelector('#inspector-title') as HTMLElement;
    this.timeDisplay = this.appRoot.querySelector('#vz-timecode') as HTMLElement;
    this.playBtn = this.appRoot.querySelector('#btn-play') as HTMLButtonElement;
    this.trackTitleDisplay = this.appRoot.querySelector('#vz-track-info') as HTMLElement;
    this.waveformCanvas = this.appRoot.querySelector('#waveform-canvas') as HTMLCanvasElement;
    this.playheadLine = this.appRoot.querySelector('#vz-playhead') as HTMLElement;
    this.volumeSlider = this.appRoot.querySelector('#vz-volume') as HTMLInputElement;
  }

  private attachEvents(): void {
    // 1. Navegação na Activity Bar
    const tabs = this.appRoot.querySelectorAll('.vz-activity-item');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        tabs.forEach((t) => t.classList.remove('active'));
        const btn = e.currentTarget as HTMLElement;
        btn.classList.add('active');
        this.activeTab = btn.dataset.tab as ActivityTab;
        (this.appRoot.querySelector('#sub-panel-title') as HTMLElement).innerText =
          btn.querySelector('.vz-activity-label')?.textContent || '';
        this.renderSubPanel();
      });
    });

    // 2. Play / Pause / Transport
    this.playBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    const stopBtn = this.appRoot.querySelector('#btn-stop') as HTMLButtonElement;
    stopBtn.addEventListener('click', () => {
      this.audioEngine.pause();
      this.audioEngine.seek(0);
      this.isPlaying = false;
      this.playBtn.innerHTML = '▶';
      this.updatePlayhead(0);
    });

    const prevBtn = this.appRoot.querySelector('#btn-prev') as HTMLButtonElement;
    prevBtn.addEventListener('click', () => {
      this.audioEngine.seek(0);
      this.updatePlayhead(0);
    });

    // 3. Carregar Áudio
    const chooseAudioBtn = this.appRoot.querySelector('#btn-choose-audio') as HTMLButtonElement;
    const audioFileInput = this.appRoot.querySelector('#audio-file-input') as HTMLInputElement;

    chooseAudioBtn.addEventListener('click', () => {
      audioFileInput.click();
    });

    audioFileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.audioEngine.loadFile(file);
        this.drawAudioWaveform();
        this.playBtn.innerHTML = '❚❚';
        this.isPlaying = true;
      }
    });

    // 4. Volume
    this.volumeSlider.addEventListener('input', () => {
      const vol = parseFloat(this.volumeSlider.value);
      this.audioEngine.setVolume(vol);
    });

    // 4.1 Loop & Zoom
    const loopBtn = this.appRoot.querySelector('#btn-loop') as HTMLButtonElement;
    loopBtn.addEventListener('click', () => {
      this.isLooping = !this.isLooping;
      loopBtn.classList.toggle('active', this.isLooping);
    });

    const zoomBtn = this.appRoot.querySelector('#btn-zoom') as HTMLButtonElement;
    zoomBtn.addEventListener('click', () => {
      this.currentZoom = this.currentZoom === 1 ? 2 : this.currentZoom === 2 ? 4 : 1;
      zoomBtn.innerHTML = `<span>🔍 Zoom: ${this.currentZoom}</span>`;
      this.drawAudioWaveform();
    });

    // 5. Timeline Scrubbing (Arrastar Playhead)
    const tracksArea = this.appRoot.querySelector('#vz-tracks-area') as HTMLElement;
    let isScrubbing = false;

    const handleSeek = (e: MouseEvent) => {
      const rect = tracksArea.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = this.audioEngine.getPlaybackInfo().duration;
      if (dur > 0) {
        this.audioEngine.seek(progress * dur);
        this.updatePlayhead(progress);
      }
    };

    tracksArea.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) {
        handleSeek(e);
      }
    });

    window.addEventListener('mouseup', () => {
      isScrubbing = false;
    });

    // 6. Botão Exportar MP4
    const exportBtn = this.appRoot.querySelector('#btn-export-mp4') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
      if (this.onExportRequested) {
        this.onExportRequested();
      }
    });

    // 7. Fullscreen Toggle
    const fsBtn = this.appRoot.querySelector('#btn-fullscreen') as HTMLButtonElement;
    fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        this.viewportWrapper.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // 8. Pílulas de Resolução
    const resPills = this.appRoot.querySelectorAll('.vz-res-pill');
    resPills.forEach((p) => {
      p.addEventListener('click', (e) => {
        resPills.forEach((el) => el.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
      });
    });

    // 9. Input global de Imagem de Fundo
    const imgInput = this.appRoot.querySelector('#image-file-input') as HTMLInputElement;
    imgInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            this.handleNewImageUploaded(file.name, dataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // 9.1 Input específico de Logo / Capa do Álbum
    const logoInput = this.appRoot.querySelector('#logo-file-input') as HTMLInputElement;
    logoInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) {
            this.handleNewLogoUploaded(file.name, dataUrl);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // 9.2 Input para textura personalizada de Partículas
    const particleInput = this.appRoot.querySelector('#particle-file-input') as HTMLInputElement;
    if (particleInput) {
      particleInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) {
              this.renderer.particleEngine.setCustomImage(dataUrl);
              this.renderInspector();
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 9.3 Clique na pista de Partículas na Timeline
    const trackParticles = this.appRoot.querySelector('#track-particles-lane');
    if (trackParticles) {
      trackParticles.addEventListener('click', () => {
        this.selectedLayerId = 'particles-layer';
        this.renderSubPanel();
        this.renderInspector();
      });
    }

    // 10. Callback de reprodução contínua da AudioEngine
    this.audioEngine.onPlaybackChange = (info) => {
      const timeStr = `${this.formatTime(info.currentTime)} / ${this.formatTime(info.duration)}`;
      this.timeDisplay.innerText = timeStr;
      this.trackTitleDisplay.innerHTML = `<span>♪ ${info.trackName}</span>`;
      this.updatePlayhead(info.progress);

      if (info.isPlaying !== this.isPlaying) {
        this.isPlaying = info.isPlaying;
        this.playBtn.innerHTML = this.isPlaying ? '❚❚' : '▶';
      }
    };
  }

  /**
   * Processa o carregamento de uma nova imagem, aplica-a ao fundo do visualizador
   * e atualiza a galeria de media e o inspetor
   */
  public handleNewImageUploaded(name: string, dataUrl: string): void {
    const id = `img-${Date.now()}`;
    this.uploadedImages.unshift({ id, name, url: dataUrl });
    this.activeBgImageUrl = dataUrl;

    const ck = this.renderer.getCanvasKit();
    this.composition.background.setImageFromDataUrl(dataUrl, ck);
    this.composition.background.enabled = true;
    this.composition.background.style = 'image';

    this.selectedLayerId = 'background-layer';

    if (this.onImageUploaded) {
      this.onImageUploaded(dataUrl);
    }

    this.renderSubPanel();
    this.renderInspector();
  }

  /**
   * Processa o carregamento de uma imagem de capa / logo do álbum
   */
  public handleNewLogoUploaded(name: string, dataUrl: string): void {
    const id = `logo-${Date.now()}`;
    this.uploadedImages.unshift({ id, name, url: dataUrl });

    const ck = this.renderer.getCanvasKit();
    this.composition.imageLogo.setImageFromDataUrl(dataUrl, ck);
    this.composition.imageLogo.enabled = true;

    this.selectedLayerId = 'image-logo-layer';

    this.renderSubPanel();
    this.renderInspector();
  }

  private togglePlay(): void {
    if (!this.audioEngine.getAudioBuffer()) {
      this.audioEngine.generateDemoTrack().then(() => {
        this.drawAudioWaveform();
        this.audioEngine.play();
        this.playBtn.innerHTML = '❚❚';
        this.isPlaying = true;
      });
      return;
    }

    if (this.isPlaying) {
      this.audioEngine.pause();
      this.playBtn.innerHTML = '▶';
      this.isPlaying = false;
    } else {
      this.audioEngine.play();
      this.playBtn.innerHTML = '❚❚';
      this.isPlaying = true;
    }
  }

  private updatePlayhead(progress: number): void {
    const pct = Math.max(0, Math.min(100, progress * 100));
    this.playheadLine.style.left = `${pct}%`;
  }

  /**
   * Renderiza a forma de onda do ficheiro de áudio real carregado no canvas da timeline
   */
  public drawAudioWaveform(): void {
    const buffer = this.audioEngine.getAudioBuffer();
    if (!buffer) return;

    const canvas = this.waveformCanvas;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(100, rect.width || 800);
    canvas.height = Math.max(20, rect.height || 52);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff2a7a'; // Magenta/Vermelho néon como na imagem do utilizador

    ctx.beginPath();
    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }

  /**
   * Renderiza a lista do Sub-painel esquerdo dependendo da tab selecionada na Activity Bar
   */
  public renderSubPanel(): void {
    this.subPanelContent.innerHTML = '';

    if (this.activeTab === 'media') {
      // 1. Separadores Uploads / Stock (como no print)
      const tabs = document.createElement('div');
      tabs.className = 'vz-media-tabs';
      tabs.innerHTML = `
        <button class="vz-media-tab-btn active">Uploads</button>
        <button class="vz-media-tab-btn">Stock</button>
      `;
      this.subPanelContent.appendChild(tabs);

      // 2. Grupo Audio
      const audRow = document.createElement('div');
      audRow.className = 'vz-media-accordion-header';
      audRow.innerHTML = `
        <span>▾ Audio</span>
        <span style="font-size: 14px; color: var(--vz-accent-cyan); cursor: pointer;" title="Carregar Áudio">📎</span>
      `;
      const chooseAudBtn = audRow.querySelector('span:last-child') as HTMLElement;
      chooseAudBtn.addEventListener('click', () => {
        (this.appRoot.querySelector('#audio-file-input') as HTMLInputElement).click();
      });
      this.subPanelContent.appendChild(audRow);

      // 3. Grupo Images (Galeria de Imagens de Fundo)
      const imgRow = document.createElement('div');
      imgRow.className = 'vz-media-accordion-header';
      imgRow.innerHTML = `
        <span>▾ Images</span>
        <span id="btn-sub-upload-img" style="font-size: 14px; color: var(--vz-accent-cyan); cursor: pointer;" title="Carregar Nova Imagem">📎</span>
      `;
      const uploadIcon = imgRow.querySelector('#btn-sub-upload-img') as HTMLElement;
      const fileInput = this.appRoot.querySelector('#image-file-input') as HTMLInputElement;
      uploadIcon.addEventListener('click', () => fileInput.click());
      this.subPanelContent.appendChild(imgRow);

      // Galeria em grelha com miniaturas das imagens carregadas
      const gallery = document.createElement('div');
      gallery.className = 'vz-media-gallery';

      // Card 1: Botão de Adicionar Nova Imagem
      const addCard = document.createElement('div');
      addCard.className = 'vz-media-card vz-media-upload-card';
      addCard.innerHTML = `
        <span style="font-size: 18px;">+</span>
        <span>Upload</span>
      `;
      addCard.addEventListener('click', () => fileInput.click());
      gallery.appendChild(addCard);

      // Cards das imagens carregadas
      this.uploadedImages.forEach((img) => {
        const card = document.createElement('div');
        const isCurrentBg = img.url === this.activeBgImageUrl;
        const isCurrentLogo = img.url === this.composition.imageLogo.getImageSrc();
        card.className = `vz-media-card ${isCurrentBg ? 'active' : ''}`;
        card.title = `"${img.name}"`;
        card.innerHTML = `
          <img src="${img.url}" alt="${img.name}" />
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(8,10,16,0.88); padding: 3px 4px; display: flex; gap: 4px; justify-content: center;">
            <button class="btn-set-bg" style="flex: 1; background: ${isCurrentBg ? 'var(--vz-accent-cyan)' : '#252d42'}; border: none; color: #fff; font-size: 9px; font-weight: 600; padding: 3px 0; border-radius: 3px; cursor: pointer;">🖼 Fundo</button>
            <button class="btn-set-logo" style="flex: 1; background: ${isCurrentLogo ? 'var(--vz-accent-pink)' : '#252d42'}; border: none; color: #fff; font-size: 9px; font-weight: 600; padding: 3px 0; border-radius: 3px; cursor: pointer;">💿 Capa</button>
          </div>
        `;

        const btnSetBg = card.querySelector('.btn-set-bg') as HTMLElement;
        btnSetBg.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeBgImageUrl = img.url;
          const ck = this.renderer.getCanvasKit();
          this.composition.background.setImageFromDataUrl(img.url, ck);
          this.composition.background.style = 'image';
          this.composition.background.enabled = true;
          this.selectedLayerId = 'background-layer';
          this.renderSubPanel();
          this.renderInspector();
        });

        const btnSetLogo = card.querySelector('.btn-set-logo') as HTMLElement;
        btnSetLogo.addEventListener('click', (e) => {
          e.stopPropagation();
          const ck = this.renderer.getCanvasKit();
          this.composition.imageLogo.setImageFromDataUrl(img.url, ck);
          this.composition.imageLogo.enabled = true;
          this.selectedLayerId = 'image-logo-layer';
          this.renderSubPanel();
          this.renderInspector();
        });

        card.addEventListener('click', () => {
          this.activeBgImageUrl = img.url;
          const ck = this.renderer.getCanvasKit();
          this.composition.background.setImageFromDataUrl(img.url, ck);
          this.composition.background.style = 'image';
          this.composition.background.enabled = true;
          this.selectedLayerId = 'background-layer';
          this.renderSubPanel();
          this.renderInspector();
        });

        gallery.appendChild(card);
      });

      this.subPanelContent.appendChild(gallery);

      // 4. Grupo Videos
      const vidRow = document.createElement('div');
      vidRow.className = 'vz-media-accordion-header';
      vidRow.innerHTML = `
        <span>▾ Videos</span>
        <span style="font-size: 14px; color: var(--vz-text-muted);">📎</span>
      `;
      this.subPanelContent.appendChild(vidRow);
      return;
    }

    if (this.activeTab === 'composition' || this.activeTab === 'effects') {
      const layers = this.composition.getLayers();
      layers.forEach((layer) => {
        const item = document.createElement('div');
        item.className = `vz-tree-item ${layer.id === this.selectedLayerId ? 'selected' : ''}`;
        item.innerHTML = `
          <div class="vz-tree-item-left">
            <span>❖</span>
            <span>${layer.name}</span>
          </div>
          <button class="vz-tree-toggle ${layer.enabled ? 'active' : ''}" title="Alternar Visibilidade">
            ${layer.enabled ? '👁️' : '👁️‍🗨️'}
          </button>
        `;

        item.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') {
            layer.enabled = !layer.enabled;
            this.renderSubPanel();
            this.renderInspector();
            return;
          }
          this.selectedLayerId = layer.id;
          this.renderSubPanel();
          this.renderInspector();
        });

        this.subPanelContent.appendChild(item);
      });

      // Adiciona o item do Sistema de Partículas 3D
      const pItem = document.createElement('div');
      pItem.className = `vz-tree-item ${this.selectedLayerId === 'particles-layer' ? 'selected' : ''}`;
      pItem.innerHTML = `
        <div class="vz-tree-item-left">
          <span>✨</span>
          <span>Partículas 3D (Particles)</span>
        </div>
        <button class="vz-tree-toggle ${this.renderer.particlesEnabled ? 'active' : ''}" title="Alternar Visibilidade">
          ${this.renderer.particlesEnabled ? '👁️' : '👁️‍🗨️'}
        </button>
      `;

      pItem.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') {
          this.renderer.particlesEnabled = !this.renderer.particlesEnabled;
          this.renderSubPanel();
          this.renderInspector();
          return;
        }
        this.selectedLayerId = 'particles-layer';
        this.renderSubPanel();
        this.renderInspector();
      });

      this.subPanelContent.appendChild(pItem);
    } else if (this.activeTab === 'analyzers') {
      const analyzers = [
        { name: 'CQT 120-Band Log Transform', icon: '📊' },
        { name: 'Sub-bass Transient Kick', icon: '💥' },
        { name: 'Spectral Tilt (+4dB/oct)', icon: '📈' },
        { name: 'RMS Dynamic Range', icon: '🎚️' },
      ];

      analyzers.forEach((an) => {
        const item = document.createElement('div');
        item.className = 'vz-tree-item';
        item.innerHTML = `
          <div class="vz-tree-item-left">
            <span>${an.icon}</span>
            <span>${an.name}</span>
          </div>
          <span style="font-size: 11px; color: var(--vz-accent-cyan);">Ativo</span>
        `;
        this.subPanelContent.appendChild(item);
      });
    } else if (this.activeTab === 'automations') {
      const autos = [
        { name: 'Global alpha', val: '1.0' },
        { name: 'Kick Scale Expansion', val: 'Reactive' },
        { name: 'Bloom Intensity Pulse', val: 'Reactive' },
        { name: 'Camera Shake Z-Punch', val: 'Active' },
      ];

      autos.forEach((au) => {
        const item = document.createElement('div');
        item.className = 'vz-tree-item';
        item.innerHTML = `
          <div class="vz-tree-item-left">
            <span>❖</span>
            <span>${au.name}</span>
          </div>
          <span style="font-size: 11px; color: var(--vz-text-muted);">${au.val}</span>
        `;
        this.subPanelContent.appendChild(item);
      });
    } else if (this.activeTab === 'projects') {
      Object.keys(PRESETS).forEach((key) => {
        const pr = PRESETS[key];
        const item = document.createElement('div');
        item.className = 'vz-tree-item';
        item.innerHTML = `
          <div class="vz-tree-item-left">
            <span>💾</span>
            <span>${pr.name}</span>
          </div>
          <span style="font-size: 11px; color: var(--vz-accent-cyan);">Aplicar</span>
        `;
        item.addEventListener('click', () => {
          this.composition.applyPreset(key, this.renderer);
          this.renderInspector();
        });
        this.subPanelContent.appendChild(item);
      });
    } else if (this.activeTab === 'lyrics') {
      const item = document.createElement('div');
      item.className = 'vz-tree-item';
      item.innerHTML = `
        <div class="vz-tree-item-left">
          <span>🔤</span>
          <span>Tipografia / Título</span>
        </div>
      `;
      item.addEventListener('click', () => {
        this.selectedLayerId = 'text-typography-layer';
        this.renderInspector();
      });
      this.subPanelContent.appendChild(item);
    }
  }

  /**
   * Renderiza a árvore do Inspector no painel direito com propriedades ao vivo
   */
  public renderInspector(): void {
    const selectedLayer = this.composition.getLayer(this.selectedLayerId);
    this.inspectorBody.innerHTML = '';

    // =========================================================================
    // CASO 0: SELECIONADO O OBJETO "PARTICLES" (VIZZY STYLE)
    // =========================================================================
    if (this.selectedLayerId === 'particles-layer') {
      this.renderParticlesInspector();
      return;
    }

    // =========================================================================
    // CASO 1: SELECIONADO O OBJETO "IMAGE" (PLANO DE FUNDO COMO NO PRINT)
    // =========================================================================
    if (selectedLayer && selectedLayer.id === 'background-layer') {
      this.inspectorHeaderTitle.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span>Objects / Image</span>
          <div style="display: flex; gap: 8px; font-size: 13px; color: var(--vz-text-muted);">
            <span style="cursor: pointer;" title="Curva de Automação">📈</span>
            <span style="cursor: pointer;" title="Definições">⚙️</span>
          </div>
        </div>
      `;

      // Tabs: File | Link (idêntico ao print)
      const tabsRow = document.createElement('div');
      tabsRow.style.cssText = 'display: flex; gap: 4px; background: #0f121d; padding: 3px; border-radius: 6px; margin-bottom: 12px; border: 1px solid var(--vz-border);';
      tabsRow.innerHTML = `
        <button style="flex: 1; background: #202638; border: none; color: #fff; padding: 5px; font-size: 11px; font-weight: 600; border-radius: 4px; cursor: pointer;">File</button>
        <button style="flex: 1; background: transparent; border: none; color: var(--vz-text-muted); padding: 5px; font-size: 11px; font-weight: 600; border-radius: 4px; cursor: pointer;">Link</button>
      `;
      this.inspectorBody.appendChild(tabsRow);

      // Linha com Miniatura da Imagem + Botão [☁ Upload]
      const fileRow = document.createElement('div');
      fileRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; background: #0e111a; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--vz-border);';
      fileRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <button style="background: transparent; border: 1px solid var(--vz-border); color: #fff; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 11px;">‹</button>
          <img id="img-inspector-preview" src="${this.activeBgImageUrl || ''}" style="width: 76px; height: 46px; object-fit: cover; border-radius: 4px; border: 1px solid var(--vz-border); background: #000;" />
        </div>
        <button id="btn-upload-direct" style="background: #252d42; border: 1px solid #3d4a6e; color: #ffffff; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s;">
          <span>☁ Upload</span>
        </button>
      `;
      this.inspectorBody.appendChild(fileRow);

      const btnUploadDirect = fileRow.querySelector('#btn-upload-direct') as HTMLButtonElement;
      const fileInput = this.appRoot.querySelector('#image-file-input') as HTMLInputElement;
      btnUploadDirect.addEventListener('click', () => fileInput.click());

      // Controles diretos idênticos ao print do Vizzy:
      const bg = this.composition.background;

      // Checkbox: Use layer as image
      const rowUseLayer = document.createElement('div');
      rowUseLayer.className = 'vz-field-row';
      rowUseLayer.innerHTML = `
        <span class="vz-field-label">Use layer as image</span>
        <input type="checkbox" class="vz-field-checkbox" ${bg.style === 'image' ? 'checked' : ''} />
      `;
      (rowUseLayer.querySelector('input') as HTMLInputElement).addEventListener('change', (e) => {
        bg.style = (e.target as HTMLInputElement).checked ? 'image' : 'grid';
      });
      this.inspectorBody.appendChild(rowUseLayer);

      // Dropdown: Mirror
      const rowMirror = document.createElement('div');
      rowMirror.className = 'vz-field-row';
      rowMirror.innerHTML = `
        <span class="vz-field-label">Mirror</span>
        <select class="vz-field-select" id="sel-mirror">
          <option value="none" ${bg.mirror === 'none' ? 'selected' : ''}>None</option>
          <option value="horizontal" ${bg.mirror === 'horizontal' ? 'selected' : ''}>Horizontal</option>
          <option value="vertical" ${bg.mirror === 'vertical' ? 'selected' : ''}>Vertical</option>
        </select>
      `;
      (rowMirror.querySelector('select') as HTMLSelectElement).addEventListener('change', (e) => {
        bg.mirror = (e.target as HTMLSelectElement).value as any;
      });
      this.inspectorBody.appendChild(rowMirror);

      // Slider/Input: Vignette
      this.addSliderField(this.inspectorBody, 'Vignette', 0, 1, bg.vignette, 0.05, '', (v) => {
        bg.vignette = v;
      });

      // Dropdown: Audio analyzer
      const rowAnalyzer = document.createElement('div');
      rowAnalyzer.className = 'vz-field-row';
      rowAnalyzer.innerHTML = `
        <span class="vz-field-label">Audio analyzer</span>
        <select class="vz-field-select" id="sel-analyzer">
          <option value="default" ${bg.reactToAudio ? 'selected' : ''}>Default (Kick Pulse)</option>
          <option value="none" ${!bg.reactToAudio ? 'selected' : ''}>None</option>
        </select>
      `;
      (rowAnalyzer.querySelector('select') as HTMLSelectElement).addEventListener('change', (e) => {
        bg.reactToAudio = (e.target as HTMLSelectElement).value === 'default';
      });
      this.inspectorBody.appendChild(rowAnalyzer);

      // Checkbox: Fit to screen
      const rowFit = document.createElement('div');
      rowFit.className = 'vz-field-row';
      rowFit.innerHTML = `
        <span class="vz-field-label">Fit to screen</span>
        <input type="checkbox" class="vz-field-checkbox" ${bg.fitToScreen ? 'checked' : ''} />
      `;
      (rowFit.querySelector('input') as HTMLInputElement).addEventListener('change', (e) => {
        bg.fitToScreen = (e.target as HTMLInputElement).checked;
      });
      this.inspectorBody.appendChild(rowFit);

      // Secções Dobráveis: Color, Transform, Basics
      const secColor = this.createAccordion('▸ Color', false);
      this.addSliderField(secColor.content, 'Opacidade', 0, 1, bg.opacity, 0.05, '', (v) => (bg.opacity = v));
      this.inspectorBody.appendChild(secColor.container);

      const secTrans = this.createAccordion('▸ Transform', false);
      this.addSliderField(secTrans.content, 'Escala', 0.5, 2.5, bg.scale, 0.05, 'x', (v) => (bg.scale = v));
      this.addSliderField(secTrans.content, 'Posição X', -300, 300, bg.offsetX, 5, 'px', (v) => (bg.offsetX = v));
      this.addSliderField(secTrans.content, 'Posição Y', -300, 300, bg.offsetY, 5, 'px', (v) => (bg.offsetY = v));
      this.inspectorBody.appendChild(secTrans.container);

      const secBasics = this.createAccordion('▸ Basics', false);
      this.addCheckboxField(secBasics.content, 'Visível', bg.enabled, (chk) => (bg.enabled = chk));
      this.inspectorBody.appendChild(secBasics.container);

      return;
    }

    // =========================================================================
    // CASO 2: OUTRO OBJETO SELECIONADO (ANEL, BARRAS, WAVEFORM, BLOOM, ETC)
    // =========================================================================
    this.inspectorHeaderTitle.innerText = selectedLayer ? selectedLayer.name : 'No selected object';

    // Seção 1: Propriedades do Objeto Selecionado (Prioridade máxima no topo)
    if (selectedLayer) {
      const secProps = this.createAccordion(`▸ Parâmetros: ${selectedLayer.name}`, true);
      this.populateLayerProperties(selectedLayer, secProps.content);
      this.inspectorBody.appendChild(secProps.container);
    }

    // Seção 2: Camadas & Hierarquia (Recolhido por padrão para não roubar espaço)
    const secLayers = this.createAccordion('▸ Layers & Hierarquia', false);
    const layersList = this.composition.getLayers();
    layersList.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'vz-field-row';
      row.innerHTML = `
        <span class="vz-field-label" style="${l.id === this.selectedLayerId ? 'color: var(--vz-accent-cyan); font-weight: 700;' : ''}">${l.name}</span>
        <input type="checkbox" class="vz-field-checkbox" ${l.enabled ? 'checked' : ''} />
      `;
      const chk = row.querySelector('input') as HTMLInputElement;
      chk.addEventListener('change', () => {
        l.enabled = chk.checked;
        this.renderSubPanel();
      });
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName.toLowerCase() !== 'input') {
          this.selectedLayerId = l.id;
          this.renderSubPanel();
          this.renderInspector();
        }
      });
      secLayers.content.appendChild(row);
    });
    this.inspectorBody.appendChild(secLayers.container);

    // Seção 3: Efeitos Three.js
    const secEffects = this.createAccordion('▸ Effects (Three.js Bloom & Pós)', false);
    this.populateEffectsProperties(secEffects.content);
    this.inspectorBody.appendChild(secEffects.container);
  }

  private createAccordion(title: string, defaultOpen: boolean): { container: HTMLElement; content: HTMLElement } {
    const card = document.createElement('div');
    card.className = 'vz-accordion-section';

    const header = document.createElement('div');
    header.className = 'vz-accordion-header';
    header.innerHTML = `<span>${title}</span><span>${defaultOpen ? '▼' : '►'}</span>`;

    const content = document.createElement('div');
    content.className = 'vz-accordion-content';
    content.style.display = defaultOpen ? 'flex' : 'none';

    header.addEventListener('click', () => {
      const isOpen = content.style.display !== 'none';
      content.style.display = isOpen ? 'none' : 'flex';
      header.innerHTML = `<span>${title}</span><span>${isOpen ? '►' : '▼'}</span>`;
    });

    card.appendChild(header);
    card.appendChild(content);

    return { container: card, content };
  }

  private populateLayerProperties(layer: BaseLayer, container: HTMLElement): void {
    if (layer.id === 'spectrum-ring-layer') {
      const ring = this.composition.spectrumRing;
      this.addSliderField(container, 'Espessura do Traço', 1, 15, ring.strokeWidth, 1, 'px', (v) => (ring.strokeWidth = v));
      this.addSliderField(container, 'Deformação Harmónica', 10, 200, ring.deformationScale, 5, '', (v) => (ring.deformationScale = v));
      this.addSliderField(container, 'Expansão no Bumbo', 0, 80, ring.kickExpansion, 2, 'px', (v) => (ring.kickExpansion = v));
      this.addColorField(container, 'Cor Principal', rgbToHex(...ring.primaryColor), (hex) => (ring.primaryColor = hexToRgb(hex)));
      this.addColorField(container, 'Cor do Kick', rgbToHex(...ring.kickColor), (hex) => (ring.kickColor = hexToRgb(hex)));
      this.addCheckboxField(container, 'Onda de Choque', ring.shockwaveEnabled, (chk) => (ring.shockwaveEnabled = chk));
    } else if (layer.id === 'spectrum-bars-layer') {
      const bars = this.composition.spectrumBars;

      // Opção de Posição: Topo, Rodapé ou Centro
      this.addSelectField(
        container,
        'Posição no Ecrã',
        [
          { label: 'Rodapé (Inferior)', value: 'bottom' },
          { label: 'Centro (Simétrico)', value: 'center' },
          { label: 'Topo (Superior)', value: 'top' },
        ],
        bars.position,
        (val) => {
          bars.position = val as any;
        }
      );

      this.addSliderField(container, 'Ajuste Vertical (Y)', -250, 250, bars.offsetY, 5, 'px', (v) => (bars.offsetY = v));
      this.addCheckboxField(container, 'Espelhado Bilateral (Graves ao Centro)', bars.mirrored, (chk) => (bars.mirrored = chk));
      this.addSliderField(container, 'Contagem de Barras', 16, 80, bars.barCount, 4, '', (v) => (bars.barCount = Math.round(v)));
      this.addSliderField(container, 'Altura Máxima', 30, 240, bars.maxHeight, 5, 'px', (v) => (bars.maxHeight = v));
      this.addSliderField(container, 'Largura da Barra', 0.2, 0.95, bars.barWidthRatio, 0.05, '', (v) => (bars.barWidthRatio = v));
      this.addSliderField(container, 'Cantos Arredondados', 0, 10, bars.cornerRadius, 1, 'px', (v) => (bars.cornerRadius = v));
      this.addColorField(container, 'Cor Graves / Baixos', rgbToHex(...bars.colorLow), (hex) => (bars.colorLow = hexToRgb(hex)));
      this.addColorField(container, 'Cor Agudos / Altos', rgbToHex(...bars.colorHigh), (hex) => (bars.colorHigh = hexToRgb(hex)));
      this.addSliderField(container, 'Opacidade', 0, 1, bars.opacity, 0.05, '', (v) => (bars.opacity = v));
    } else if (layer.id === 'waveform-layer') {
      const wave = this.composition.waveform;
      this.addSliderField(container, 'Amplitude', 15, 150, wave.amplitude, 5, '', (v) => (wave.amplitude = v));
      this.addSliderField(container, 'Espessura', 1, 8, wave.strokeWidth, 1, 'px', (v) => (wave.strokeWidth = v));
      this.addSliderField(container, 'Posição Y', -150, 150, wave.positionYOffset, 5, '', (v) => (wave.positionYOffset = v));
      this.addColorField(container, 'Cor da Onda', rgbToHex(...wave.color), (hex) => (wave.color = hexToRgb(hex)));
    } else if (layer.id === 'image-logo-layer') {
      const logo = this.composition.imageLogo;

      // Card com Pré-visualização da Capa do Álbum e Botão [☁ Upload]
      const logoCard = document.createElement('div');
      logoCard.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; background: #0e111a; padding: 10px; border-radius: 6px; border: 1px solid var(--vz-border);';

      const logoSrc = logo.getImageSrc();
      const previewHtml = logoSrc
        ? `<img id="img-logo-preview" src="${logoSrc}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--vz-accent-cyan);" />`
        : `<div style="width: 50px; height: 50px; border-radius: 50%; background: #161b2b; display: flex; align-items: center; justify-content: center; font-size: 22px; border: 1px dashed var(--vz-border);">💿</div>`;

      logoCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          ${previewHtml}
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 12px; font-weight: 600; color: #fff;">${logoSrc ? 'Capa Carregada' : 'Sem Imagem'}</span>
            <span style="font-size: 10px; color: var(--vz-text-muted);">${logoSrc ? 'Recorte Circular' : 'Vinil Procedural'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button id="btn-upload-logo-layer" style="background: #252d42; border: 1px solid #3d4a6e; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <span>☁ Upload</span>
          </button>
          ${logoSrc ? `<button id="btn-clear-logo-layer" title="Remover imagem" style="background: transparent; border: 1px solid var(--vz-border); color: #ff6b6b; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">✕</button>` : ''}
        </div>
      `;
      container.appendChild(logoCard);

      const btnUploadLogo = logoCard.querySelector('#btn-upload-logo-layer') as HTMLButtonElement;
      const logoInput = this.appRoot.querySelector('#logo-file-input') as HTMLInputElement;
      btnUploadLogo.addEventListener('click', () => logoInput.click());

      const btnClearLogo = logoCard.querySelector('#btn-clear-logo-layer') as HTMLButtonElement | null;
      if (btnClearLogo) {
        btnClearLogo.addEventListener('click', () => {
          logo.clearImage();
          this.renderInspector();
        });
      }

      this.addSliderField(container, 'Raio Central', 30, 200, logo.radius, 5, 'px', (v) => (logo.radius = v));
      this.addSliderField(container, 'Posição Y (Offset)', -250, 250, logo.offsetY, 5, 'px', (v) => (logo.offsetY = v));
      this.addSliderField(container, 'Posição X (Offset)', -250, 250, logo.offsetX, 5, 'px', (v) => (logo.offsetX = v));
      this.addCheckboxField(container, 'Rotação Contínua', logo.autoRotate, (chk) => (logo.autoRotate = chk));
      this.addSliderField(container, 'Velocidade', -2, 2, logo.rotationSpeed, 0.1, '', (v) => (logo.rotationSpeed = v));
      this.addSliderField(container, 'Salto no Bumbo', 0, 0.8, logo.kickScale, 0.05, '', (v) => (logo.kickScale = v));
      this.addSliderField(container, 'Espessura da Borda', 0, 16, logo.borderWidth, 1, 'px', (v) => (logo.borderWidth = v));
      this.addColorField(container, 'Cor da Borda', rgbToHex(...logo.borderColor), (hex) => (logo.borderColor = hexToRgb(hex)));
      this.addSliderField(container, 'Opacidade', 0, 1, logo.opacity, 0.05, '', (v) => (logo.opacity = v));
    } else if (layer.id === 'text-typography-layer') {
      const txt = this.composition.textTypography;
      this.addTextField(container, 'Título', txt.title, (t) => (txt.title = t));
      this.addTextField(container, 'Subtítulo', txt.subtitle, (s) => (txt.subtitle = s));
      this.addSliderField(container, 'Tamanho Título', 14, 44, txt.titleSize, 1, 'px', (v) => (txt.titleSize = Math.round(v)));
      this.addCheckboxField(container, 'Salto no Bumbo', txt.bounceOnKick, (chk) => (txt.bounceOnKick = chk));
    }
  }

  private populateEffectsProperties(container: HTMLElement): void {
    this.addSliderField(container, 'Bloom Strength', 0, 3.5, 0.85, 0.1, '', (v) => {
      this.renderer.setBloomConfig(v, 0.35, 0.82);
    });
    this.addSliderField(container, 'Bloom Radius', 0, 1, 0.35, 0.05, '', (v) => {
      this.renderer.setBloomConfig(0.85, v, 0.82);
    });
    this.addSliderField(container, 'Bloom Threshold', 0, 1, 0.82, 0.02, '', (v) => {
      this.renderer.setBloomConfig(0.85, 0.35, v);
    });
    this.addCheckboxField(container, 'Aberração Cromática', this.renderer.chromaticAberrationEnabled, (chk) => {
      this.renderer.chromaticAberrationEnabled = chk;
    });
    this.addCheckboxField(container, 'Partículas 3D (1500)', this.renderer.particlesEnabled, (chk) => {
      this.renderer.particlesEnabled = chk;
    });
  }

  private addSliderField(
    container: HTMLElement,
    label: string,
    min: number,
    max: number,
    val: number,
    step: number,
    suffix: string,
    onChange: (v: number) => void
  ): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <input type="range" class="vz-field-slider" min="${min}" max="${max}" step="${step}" value="${val}" />
      <span class="vz-field-val">${val}${suffix}</span>
    `;
    const slider = row.querySelector('input') as HTMLInputElement;
    const valDisplay = row.querySelector('.vz-field-val') as HTMLElement;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valDisplay.innerText = `${slider.value}${suffix}`;
      onChange(v);
    });
    container.appendChild(row);
  }

  private addColorField(container: HTMLElement, label: string, hex: string, onChange: (hex: string) => void): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <input type="color" class="vz-field-color" value="${hex}" />
    `;
    const picker = row.querySelector('input') as HTMLInputElement;
    picker.addEventListener('input', () => onChange(picker.value));
    container.appendChild(row);
  }

  private addCheckboxField(container: HTMLElement, label: string, checked: boolean, onChange: (chk: boolean) => void): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <input type="checkbox" class="vz-field-checkbox" ${checked ? 'checked' : ''} />
    `;
    const chk = row.querySelector('input') as HTMLInputElement;
    chk.addEventListener('change', () => onChange(chk.checked));
    container.appendChild(row);
  }

  private addTextField(container: HTMLElement, label: string, val: string, onChange: (t: string) => void): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <input type="text" class="vz-field-input" value="${val}" />
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    input.addEventListener('input', () => onChange(input.value));
    container.appendChild(row);
  }

  private addSelectField(
    container: HTMLElement,
    label: string,
    options: Array<{ label: string; value: string }>,
    currentValue: string,
    onChange: (val: string) => void
  ): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    const optsHtml = options
      .map(
        (opt) => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.label}</option>`
      )
      .join('');
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <select class="vz-field-select">${optsHtml}</select>
    `;
    const sel = row.querySelector('select') as HTMLSelectElement;
    sel.addEventListener('change', () => onChange(sel.value));
    container.appendChild(row);
  }

  private addNumberField(
    container: HTMLElement,
    label: string,
    val: number,
    onChange: (v: number) => void
  ): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <input type="number" class="vz-field-num" value="${val}" style="width: 70px; background: #10131e; border: 1px solid var(--vz-border); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-align: right;" />
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    input.addEventListener('change', () => {
      const v = parseFloat(input.value) || 0;
      onChange(v);
    });
    container.appendChild(row);
  }

  private addDualNumberField(
    container: HTMLElement,
    label: string,
    val1: number,
    val2: number,
    onChange: (v1: number, v2: number) => void
  ): void {
    const row = document.createElement('div');
    row.className = 'vz-field-row';
    row.innerHTML = `
      <span class="vz-field-label">${label}</span>
      <div style="display: flex; gap: 6px;">
        <input type="number" step="0.1" class="vz-field-num" id="dual-1" value="${val1}" style="width: 48px; background: #10131e; border: 1px solid var(--vz-border); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 12px; text-align: right;" />
        <input type="number" step="0.1" class="vz-field-num" id="dual-2" value="${val2}" style="width: 48px; background: #10131e; border: 1px solid var(--vz-border); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 12px; text-align: right;" />
      </div>
    `;
    const in1 = row.querySelector('#dual-1') as HTMLInputElement;
    const in2 = row.querySelector('#dual-2') as HTMLInputElement;
    const notify = () => {
      onChange(parseFloat(in1.value) || 0, parseFloat(in2.value) || 0);
    };
    in1.addEventListener('change', notify);
    in2.addEventListener('change', notify);
    container.appendChild(row);
  }

  /**
   * Renderiza o Inspetor de Partículas 3D (Objects / Particles) fiel ao Vizzy.io
   */
  private renderParticlesInspector(): void {
    const pe = this.renderer.particleEngine;
    const cfg = pe.config;

    this.inspectorHeaderTitle.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span>Objects / Particles</span>
        <div style="display: flex; gap: 8px; font-size: 13px; color: var(--vz-text-muted);">
          <span style="cursor: pointer;" title="Curva de Automação">📈</span>
          <span style="cursor: pointer;" title="Definições">⚙️</span>
        </div>
      </div>
    `;

    // 0. Seletor Visual dos 3 Estilos de Movimento (Starfield 3D / Neve / Orbital)
    const styleLabel = document.createElement('div');
    styleLabel.style.cssText = 'font-size: 11px; color: var(--vz-text); margin: 6px 0 6px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
    styleLabel.innerText = 'Estilo de Movimento';
    this.inspectorBody.appendChild(styleLabel);

    const styleGrid = document.createElement('div');
    styleGrid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;';

    const styles: { id: ParticleMovementStyle; label: string; icon: string; desc: string }[] = [
      { id: 'starfield', label: 'Starfield 3D', icon: '💫', desc: 'Em direção à tela (Perspectiva 3D)' },
      { id: 'snow', label: 'Neve', icon: '❄️', desc: 'Queda suave com gravidade e vento' },
      { id: 'orbit', label: 'Orbital', icon: '🪐', desc: 'Constelação tridimensional em disco' },
    ];

    styles.forEach((st) => {
      const btn = document.createElement('button');
      const isSelected = (cfg.movementStyle || 'starfield') === st.id;
      btn.style.cssText = `
        padding: 8px 4px;
        background: ${isSelected ? '#202a48' : '#141824'};
        border: ${isSelected ? '2px solid #5070ff' : '1px solid #232a3c'};
        box-shadow: ${isSelected ? '0 0 10px rgba(80, 112, 255, 0.4)' : 'none'};
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      btn.title = st.desc;
      btn.innerHTML = `
        <span style="font-size: 18px;">${st.icon}</span>
        <span style="font-size: 11px; font-weight: ${isSelected ? '700' : '500'}; color: ${isSelected ? '#fff' : '#b0b8d0'}; text-align: center; line-height: 1.1;">${st.label}</span>
      `;
      btn.addEventListener('click', () => {
        pe.setConfig({ movementStyle: st.id });
        this.renderInspector();
      });
      styleGrid.appendChild(btn);
    });
    this.inspectorBody.appendChild(styleGrid);

    // Velocidade de Movimento (Speed Multiplier)
    this.addSliderField(this.inspectorBody, 'Velocidade', 0.2, 3.0, cfg.speed || 1.0, 0.1, 'x', (v) => {
      pe.setConfig({ speed: v });
    });

    // Reagir às Batidas da Música (Kick / Áudio)
    this.addCheckboxField(this.inspectorBody, 'Reagir às Batidas', cfg.reactToAudio ?? true, (chk) => {
      pe.setConfig({ reactToAudio: chk });
      this.renderInspector();
    });

    if (cfg.reactToAudio ?? true) {
      this.addSliderField(this.inspectorBody, 'Sensibilidade do Bumbo', 0.1, 2.0, cfg.beatReactivity ?? 1.0, 0.1, 'x', (v) => {
        pe.setConfig({ beatReactivity: v });
      });
    }

    // 1. Back limit time
    this.addNumberField(this.inspectorBody, 'Back limit time', cfg.backLimitTime, (v) => {
      pe.setConfig({ backLimitTime: v });
    });

    // 2. Alpha multiplier
    this.addSliderField(this.inspectorBody, 'Alpha multiplier', 0.1, 2.5, cfg.alphaMultiplier, 0.1, '', (v) => {
      pe.setConfig({ alphaMultiplier: v });
    });

    // 3. Amount
    this.addNumberField(this.inspectorBody, 'Amount', cfg.amount, (v) => {
      pe.setConfig({ amount: Math.max(10, Math.min(3000, v)) });
    });

    // 4. Opacity (min e max lado a lado como no print)
    this.addDualNumberField(this.inspectorBody, 'Opacity', cfg.opacityMin, cfg.opacityMax, (min, max) => {
      pe.setConfig({ opacityMin: min, opacityMax: max });
    });

    // 5. Size (min e max lado a lado como no print: 0,2 e 0,6)
    this.addDualNumberField(this.inspectorBody, 'Size', cfg.sizeMin, cfg.sizeMax, (min, max) => {
      pe.setConfig({ sizeMin: min, sizeMax: max });
    });

    // 6. Fade in opacity
    this.addCheckboxField(this.inspectorBody, 'Fade in opacity', cfg.fadeInOpacity, (chk) => {
      pe.setConfig({ fadeInOpacity: chk });
    });

    // 7. Fade out opacity
    this.addCheckboxField(this.inspectorBody, 'Fade out opacity', cfg.fadeOutOpacity, (chk) => {
      pe.setConfig({ fadeOutOpacity: chk });
    });

    // Accordion: Appearance (Aberto por padrão com a grelha de texturas de partículas)
    const secAppearance = this.createAccordion('▾ Appearance', true);

    const pImgLabel = document.createElement('div');
    pImgLabel.style.cssText = 'font-size: 11px; color: var(--vz-text); margin: 6px 0 6px 0; font-weight: 500;';
    pImgLabel.innerText = 'Particle image';
    secAppearance.content.appendChild(pImgLabel);

    const shapesGrid = document.createElement('div');
    shapesGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;';

    const shapes: { id: ParticleShape; label: string; previewHtml: string }[] = [
      { id: 'glow-dot', label: 'Glow Dot', previewHtml: '<div style="width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 0 8px #fff;"></div>' },
      { id: 'sparkle', label: 'Sparkle', previewHtml: '<span style="font-size: 20px; color: #fff; line-height: 1;">✦</span>' },
      { id: 'glowing-orb', label: 'Glowing Orb', previewHtml: '<div style="width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid #00d2ff; box-shadow: 0 0 8px #00d2ff;"></div>' },
      { id: 'smoke-1', label: 'Smoke 1', previewHtml: '<span style="font-size: 18px; color: #d0e0ff; line-height: 1;">☁</span>' },
      { id: 'smoke-2', label: 'Smoke 2', previewHtml: '<span style="font-size: 16px; color: #b0d8ff; line-height: 1;">💨</span>' },
      { id: 'crescent', label: 'Crescent', previewHtml: '<span style="font-size: 18px; color: #fff; line-height: 1;">☽</span>' },
      { id: 'square', label: 'Square', previewHtml: '<div style="width: 16px; height: 16px; background: #fff; border-radius: 2px;"></div>' },
      { id: 'circle', label: 'Circle', previewHtml: '<div style="width: 18px; height: 18px; background: #fff; border-radius: 50%;"></div>' },
    ];

    shapes.forEach((s) => {
      const btn = document.createElement('button');
      const isSelected = cfg.shape === s.id;
      btn.style.cssText = `
        height: 38px;
        background: #141824;
        border: ${isSelected ? '2px solid #5070ff' : '1px solid #232a3c'};
        box-shadow: ${isSelected ? '0 0 10px rgba(80, 112, 255, 0.5)' : 'none'};
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      `;
      btn.title = s.label;
      btn.innerHTML = s.previewHtml;
      btn.addEventListener('click', () => {
        pe.setConfig({ shape: s.id });
        this.renderInspector();
      });
      shapesGrid.appendChild(btn);
    });
    secAppearance.content.appendChild(shapesGrid);

    // Botão Upload de textura personalizada
    const uploadBtnRow = document.createElement('div');
    uploadBtnRow.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 12px;';
    uploadBtnRow.innerHTML = `
      <button id="btn-upload-particle" style="background: #252d42; border: 1px solid #3d4a6e; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <span>☁ Upload</span>
      </button>
    `;
    secAppearance.content.appendChild(uploadBtnRow);

    const btnUploadP = uploadBtnRow.querySelector('#btn-upload-particle') as HTMLButtonElement;
    const pFileInput = this.appRoot.querySelector('#particle-file-input') as HTMLInputElement;
    btnUploadP.addEventListener('click', () => pFileInput.click());

    // Color
    this.addColorField(secAppearance.content, 'Color', cfg.color, (hex) => {
      pe.setConfig({ color: hex });
    });

    // Mirror
    this.addCheckboxField(secAppearance.content, 'Mirror', cfg.mirror, (chk) => {
      pe.setConfig({ mirror: chk });
    });

    // Constant size
    this.addCheckboxField(secAppearance.content, 'Constant size', cfg.constantSize, (chk) => {
      pe.setConfig({ constantSize: chk });
    });

    // Front limit
    this.addNumberField(secAppearance.content, 'Front limit', cfg.frontLimit, (v) => {
      pe.setConfig({ frontLimit: v });
    });

    // Front limit time
    this.addNumberField(secAppearance.content, 'Front limit time', cfg.frontLimitTime, (v) => {
      pe.setConfig({ frontLimitTime: v });
    });

    // Back limit
    this.addNumberField(secAppearance.content, 'Back limit', cfg.backLimit, (v) => {
      pe.setConfig({ backLimit: v });
    });

    // Back limit time
    this.addNumberField(secAppearance.content, 'Back limit time', cfg.backLimitTime, (v) => {
      pe.setConfig({ backLimitTime: v });
    });

    // Alpha multiplier
    this.addNumberField(secAppearance.content, 'Alpha multiplier', cfg.alphaMultiplier, (v) => {
      pe.setConfig({ alphaMultiplier: v });
    });

    this.inspectorBody.appendChild(secAppearance.container);

    // Accordions Secundários
    ['Random', 'Behaviour', 'Origin', 'Transform', 'Basics'].forEach((name) => {
      const acc = this.createAccordion(`▸ ${name}`, false);
      if (name === 'Basics') {
        this.addCheckboxField(acc.content, 'Ativo', cfg.enabled, (chk) => {
          this.renderer.particlesEnabled = chk;
        });
      }
      this.inspectorBody.appendChild(acc.container);
    });
  }
}

