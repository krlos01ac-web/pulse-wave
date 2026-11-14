import { BaseLayer, type LayerRenderContext } from '../render/layers/BaseLayer';
import { BackgroundLayer } from '../render/layers/BackgroundLayer';
import { SpectrumRingLayer } from '../render/layers/SpectrumRingLayer';
import { SpectrumBarsLayer } from '../render/layers/SpectrumBarsLayer';
import { WaveformLayer } from '../render/layers/WaveformLayer';
import { ImageLogoLayer } from '../render/layers/ImageLogoLayer';
import { TextTypographyLayer } from '../render/layers/TextTypographyLayer';
import { PRESETS } from './Presets';
import type { FboHybridRenderer } from '../render/FboHybridRenderer';

export class Composition {
  private layers: BaseLayer[] = [];

  public background: BackgroundLayer;
  public spectrumRing: SpectrumRingLayer;
  public spectrumBars: SpectrumBarsLayer;
  public waveform: WaveformLayer;
  public imageLogo: ImageLogoLayer;
  public textTypography: TextTypographyLayer;

  constructor() {
    this.background = new BackgroundLayer();
    this.spectrumRing = new SpectrumRingLayer();
    this.spectrumBars = new SpectrumBarsLayer();
    this.waveform = new WaveformLayer();
    this.imageLogo = new ImageLogoLayer();
    this.textTypography = new TextTypographyLayer();

    // Ordem de renderização (de trás para a frente)
    this.layers = [
      this.background,
      this.waveform,
      this.spectrumRing,
      this.imageLogo,
      this.spectrumBars,
      this.textTypography,
    ];
  }

  public getLayers(): BaseLayer[] {
    return this.layers;
  }

  public getLayer<T extends BaseLayer>(id: string): T | undefined {
    return this.layers.find((l) => l.id === id) as T | undefined;
  }

  /**
   * Renderiza todas as camadas ativas na ordem correta
   */
  public render(ctx: LayerRenderContext): void {
    for (const layer of this.layers) {
      if (layer.enabled) {
        layer.render(ctx);
      }
    }
  }

  /**
   * Aplica um preset estilístico instantaneamente
   */
  public applyPreset(presetKey: string, renderer?: FboHybridRenderer): void {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    for (const layer of this.layers) {
      const cfg = preset.layers[layer.id];
      if (cfg) {
        if (cfg.enabled !== undefined) layer.enabled = cfg.enabled;
        layer.setConfig(cfg);
      }
    }

    if (renderer && preset.renderer) {
      renderer.setBloomConfig(
        preset.renderer.bloomStrength,
        preset.renderer.bloomRadius,
        preset.renderer.bloomThreshold
      );
      renderer.chromaticAberrationEnabled = preset.renderer.chromaticAberration;
      renderer.particlesEnabled = preset.renderer.particles;
    }
  }

  /**
   * Serializa o estado completo da composição para JSON
   */
  public exportState(): string {
    const state: Record<string, any> = {};
    for (const layer of this.layers) {
      state[layer.id] = {
        enabled: layer.enabled,
        opacity: layer.opacity,
        config: layer.getConfig(),
      };
    }
    return JSON.stringify(state, null, 2);
  }

  /**
   * Restaura o estado da composição a partir de JSON
   */
  public importState(jsonStr: string): void {
    try {
      const state = JSON.parse(jsonStr);
      for (const layer of this.layers) {
        const item = state[layer.id];
        if (item) {
          if (item.enabled !== undefined) layer.enabled = item.enabled;
          if (item.opacity !== undefined) layer.opacity = item.opacity;
          if (item.config) layer.setConfig(item.config);
        }
      }
    } catch (err) {
      console.error('Falha ao importar estado do projeto:', err);
    }
  }
}
