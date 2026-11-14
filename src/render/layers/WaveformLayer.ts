import { BaseLayer, type LayerRenderContext } from './BaseLayer';

export class WaveformLayer extends BaseLayer {
  public strokeWidth: number = 3;
  public amplitude: number = 60;
  public color: [number, number, number] = [0, 255, 180]; // Verde esmeralda neon
  public positionYOffset: number = 0; // Offset vertical a partir do centro

  constructor(id: string = 'waveform-layer') {
    super(id, 'Forma de Onda (Osciloscópio)');
    this.enabled = false; // Desativada por padrão, ativável via inspector ou presets
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, timeDomain, spectrum } = ctx;
    const centerY = height / 2 + this.positionYOffset;
    const waveWidth = Math.min(width * 0.85, 900);
    const startX = (width - waveWidth) / 2;

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(this.strokeWidth * this.opacity);
    paint.setColor(ck.Color(this.color[0], this.color[1], this.color[2], this.opacity));

    const builder = new ck.PathBuilder();
    const points = 180;

    // Se temos amostras reais no domínio do tempo, usamos diretamente
    if (timeDomain && timeDomain.length > 0) {
      const step = Math.floor(timeDomain.length / points);
      for (let i = 0; i < points; i++) {
        const val = timeDomain[i * step] || 0;
        const x = startX + (i / (points - 1)) * waveWidth;
        const y = centerY + val * this.amplitude;

        if (i === 0) builder.moveTo(x, y);
        else builder.lineTo(x, y);
      }
    } else {
      // Reconstituição suave via harmónicos do espectro CQT
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1);
        const specIdx = Math.floor(t * spectrum.length);
        const amp = spectrum[specIdx] || 0;
        const x = startX + t * waveWidth;
        const y = centerY + Math.sin(t * Math.PI * 8 + ctx.time * 6) * amp * this.amplitude;

        if (i === 0) builder.moveTo(x, y);
        else builder.lineTo(x, y);
      }
    }

    const path = builder.detachAndDelete();
    canvas.drawPath(path, paint);

    path.delete();
    paint.delete();
  }

  public getConfig(): Record<string, any> {
    return {
      strokeWidth: this.strokeWidth,
      amplitude: this.amplitude,
      color: this.color,
      positionYOffset: this.positionYOffset,
      opacity: this.opacity,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.strokeWidth !== undefined) this.strokeWidth = config.strokeWidth;
    if (config.amplitude !== undefined) this.amplitude = config.amplitude;
    if (config.color !== undefined) this.color = config.color;
    if (config.positionYOffset !== undefined) this.positionYOffset = config.positionYOffset;
    if (config.opacity !== undefined) this.opacity = config.opacity;
  }
}
