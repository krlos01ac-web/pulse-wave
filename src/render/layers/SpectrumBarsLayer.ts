import { BaseLayer, type LayerRenderContext } from './BaseLayer';

export type SpectrumBarPosition = 'bottom' | 'center' | 'top';

export class SpectrumBarsLayer extends BaseLayer {
  public barCount: number = 48;
  public maxHeight: number = 100;
  public barWidthRatio: number = 0.7; // Largura relativa da barra
  public cornerRadius: number = 3;
  public position: SpectrumBarPosition = 'bottom'; // 'bottom' (rodapé) | 'center' (centro) | 'top' (topo)
  public offsetY: number = 0; // Deslocamento vertical fino
  public mirrored: boolean = false; // Espelhamento bilateral (graves no centro)
  public colorLow: [number, number, number] = [0, 210, 255];   // Ciano
  public colorHigh: [number, number, number] = [255, 60, 180]; // Magenta

  constructor(id: string = 'spectrum-bars-layer') {
    super(id, 'Barras Espectrais');
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, spectrum } = ctx;
    const centerX = width / 2;
    const totalWidth = Math.min(width * 0.85, 850);
    const spacing = totalWidth / this.barCount;
    const barWidth = Math.max(2, spacing * this.barWidthRatio);
    const startX = centerX - totalWidth / 2;

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Fill);

    for (let b = 0; b < this.barCount; b++) {
      // Mapeamento proporcional no espectro CQT (com ou sem espelhamento bilateral)
      let specIdx: number;
      if (this.mirrored) {
        const halfCount = Math.max(1, (this.barCount - 1) / 2);
        const distFromCenter = Math.abs(b - halfCount) / halfCount;
        specIdx = Math.floor(distFromCenter * (spectrum.length * 0.65));
      } else {
        specIdx = Math.floor((b / this.barCount) * (spectrum.length * 0.7));
      }

      const amp = spectrum[specIdx] || 0;
      const barHeight = Math.max(4, amp * this.maxHeight);
      const bx = startX + b * spacing;

      // Cálculo de posição Y conforme a opção escolhida: topo, rodapé ou centro
      let rectTop: number;
      let rectBottom: number;

      if (this.position === 'top') {
        // Topo: barras crescem para baixo
        const baseY = 55 + this.offsetY;
        rectTop = baseY;
        rectBottom = baseY + barHeight;
      } else if (this.position === 'center') {
        // Centro: barras expandem simetricamente para cima e para baixo
        const baseY = height / 2 + this.offsetY;
        rectTop = baseY - barHeight / 2;
        rectBottom = baseY + barHeight / 2;
      } else {
        // Rodapé (padrão): barras crescem para cima
        const baseY = height - 50 + this.offsetY;
        rectTop = baseY - barHeight;
        rectBottom = baseY;
      }

      // Interpolação de cor por amplitude da barra
      const t = Math.min(1.0, amp * 1.3);
      const r = Math.floor(this.colorLow[0] + (this.colorHigh[0] - this.colorLow[0]) * t);
      const g = Math.floor(this.colorLow[1] + (this.colorHigh[1] - this.colorLow[1]) * t);
      const blue = Math.floor(this.colorLow[2] + (this.colorHigh[2] - this.colorLow[2]) * t);

      paint.setColor(ck.Color(r, g, blue, 0.9 * this.opacity));

      if (this.cornerRadius > 0) {
        const rrect = ck.RRectXY(
          ck.LTRBRect(bx, rectTop, bx + barWidth, rectBottom),
          this.cornerRadius,
          this.cornerRadius
        );
        canvas.drawRRect(rrect, paint);
      } else {
        canvas.drawRect(ck.LTRBRect(bx, rectTop, bx + barWidth, rectBottom), paint);
      }
    }

    paint.delete();
  }

  public getConfig(): Record<string, any> {
    return {
      barCount: this.barCount,
      maxHeight: this.maxHeight,
      barWidthRatio: this.barWidthRatio,
      cornerRadius: this.cornerRadius,
      position: this.position,
      offsetY: this.offsetY,
      mirrored: this.mirrored,
      colorLow: this.colorLow,
      colorHigh: this.colorHigh,
      opacity: this.opacity,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.barCount !== undefined) this.barCount = config.barCount;
    if (config.maxHeight !== undefined) this.maxHeight = config.maxHeight;
    if (config.barWidthRatio !== undefined) this.barWidthRatio = config.barWidthRatio;
    if (config.cornerRadius !== undefined) this.cornerRadius = config.cornerRadius;
    if (config.position !== undefined) this.position = config.position;
    if (config.offsetY !== undefined) this.offsetY = config.offsetY;
    if (config.mirrored !== undefined) this.mirrored = config.mirrored;
    if (config.colorLow !== undefined) this.colorLow = config.colorLow;
    if (config.colorHigh !== undefined) this.colorHigh = config.colorHigh;
    if (config.opacity !== undefined) this.opacity = config.opacity;
  }
}
