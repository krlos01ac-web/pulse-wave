import { BaseLayer, type LayerRenderContext } from './BaseLayer';

export class TextTypographyLayer extends BaseLayer {
  public title: string = 'VIZZY MODULAR ENGINE';
  public subtitle: string = 'CQT DSP WORKER & WEBAUDIO';
  public titleSize: number = 26;
  public subtitleSize: number = 15;
  public bounceOnKick: boolean = true;
  public bounceAmount: number = 6;
  public colorTitle: [number, number, number] = [255, 255, 255];
  public colorSubtitle: [number, number, number] = [0, 225, 255];

  constructor(id: string = 'text-typography-layer') {
    super(id, 'Tipografia / Título');
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, bassImpact } = ctx;
    const centerX = width / 2;
    const baseRadius = Math.min(width, height) * 0.2;
    const baseY = height / 2 + baseRadius + 115;

    const bounce = this.bounceOnKick ? -bassImpact * this.bounceAmount : 0;

    const fontTitle = new ck.Font(null, this.titleSize);
    const fontSub = new ck.Font(null, this.subtitleSize);

    const measureWidth = (font: any, text: string) => {
      if (!text) return 0;
      try {
        const glyphs = font.getGlyphIDs(text);
        const widths = font.getGlyphWidths(glyphs);
        let sum = 0;
        for (let i = 0; i < widths.length; i++) {
          sum += widths[i];
        }
        return sum;
      } catch {
        return text.length * font.getSize() * 0.55;
      }
    };

    const paintTitle = new ck.Paint();
    paintTitle.setAntiAlias(true);
    paintTitle.setStyle(ck.PaintStyle.Fill);
    paintTitle.setColor(
      ck.Color(this.colorTitle[0], this.colorTitle[1], this.colorTitle[2], this.opacity)
    );

    const titleWidth = measureWidth(fontTitle, this.title);
    canvas.drawText(
      this.title,
      centerX - titleWidth / 2,
      baseY + bounce,
      paintTitle,
      fontTitle
    );

    const paintSub = new ck.Paint();
    paintSub.setAntiAlias(true);
    paintSub.setStyle(ck.PaintStyle.Fill);
    paintSub.setColor(
      ck.Color(this.colorSubtitle[0], this.colorSubtitle[1], this.colorSubtitle[2], 0.85 * this.opacity)
    );

    const subWidth = measureWidth(fontSub, this.subtitle);
    canvas.drawText(
      this.subtitle,
      centerX - subWidth / 2,
      baseY + 26 + bounce,
      paintSub,
      fontSub
    );

    paintTitle.delete();
    paintSub.delete();
    fontTitle.delete();
    fontSub.delete();
  }

  public getConfig(): Record<string, any> {
    return {
      title: this.title,
      subtitle: this.subtitle,
      titleSize: this.titleSize,
      subtitleSize: this.subtitleSize,
      bounceOnKick: this.bounceOnKick,
      colorTitle: this.colorTitle,
      colorSubtitle: this.colorSubtitle,
      opacity: this.opacity,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.title !== undefined) this.title = config.title;
    if (config.subtitle !== undefined) this.subtitle = config.subtitle;
    if (config.titleSize !== undefined) this.titleSize = config.titleSize;
    if (config.subtitleSize !== undefined) this.subtitleSize = config.subtitleSize;
    if (config.bounceOnKick !== undefined) this.bounceOnKick = config.bounceOnKick;
    if (config.colorTitle !== undefined) this.colorTitle = config.colorTitle;
    if (config.colorSubtitle !== undefined) this.colorSubtitle = config.colorSubtitle;
    if (config.opacity !== undefined) this.opacity = config.opacity;
  }
}
