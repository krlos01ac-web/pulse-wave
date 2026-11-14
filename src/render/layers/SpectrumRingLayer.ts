import { BaseLayer, type LayerRenderContext } from './BaseLayer';

export class SpectrumRingLayer extends BaseLayer {
  public baseRadiusRatio: number = 0.2; // Proporção em relação à dimensão do ecrã
  public kickExpansion: number = 40;    // Pixels de expansão no bumbo
  public deformationScale: number = 90; // Intensidade da deformação CQT
  public strokeWidth: number = 5;
  public rotationSpeed: number = 0.8;

  public primaryColor: [number, number, number] = [80, 210, 255];   // Azul neon
  public kickColor: [number, number, number] = [255, 60, 180];      // Magenta neon
  public coreGlow: boolean = true;
  public shockwaveEnabled: boolean = true;

  constructor(id: string = 'spectrum-ring-layer') {
    super(id, 'Anel Espectral CQT');
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, spectrum, bassImpact, cumulative } = ctx;
    const centerX = width / 2;
    const centerY = height / 2 - 35;

    const baseRadius = Math.min(width, height) * this.baseRadiusRatio + bassImpact * this.kickExpansion;
    const numPoints = spectrum.length;
    const builder = new ck.PathBuilder();

    for (let i = 0; i <= numPoints; i++) {
      const idx = i % numPoints;
      const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;

      const freqAmp = spectrum[idx] || 0;
      const rotation = cumulative * this.rotationSpeed;
      const wave = Math.sin(angle * 12 + rotation * 3) * (4 + bassImpact * 8);
      const deformation = freqAmp * this.deformationScale + wave;

      const r = baseRadius + deformation;
      const px = centerX + Math.cos(angle) * r;
      const py = centerY + Math.sin(angle) * r;

      if (i === 0) {
        builder.moveTo(px, py);
      } else {
        builder.lineTo(px, py);
      }
    }

    const path = builder.detachAndDelete();

    const ringPaint = new ck.Paint();
    ringPaint.setAntiAlias(true);
    ringPaint.setStyle(ck.PaintStyle.Stroke);
    ringPaint.setStrokeWidth((this.strokeWidth + bassImpact * 6) * this.opacity);

    // Interpolação de cor reativa ao bumbo
    const r = Math.min(255, this.primaryColor[0] + (this.kickColor[0] - this.primaryColor[0]) * bassImpact);
    const g = Math.min(255, this.primaryColor[1] + (this.kickColor[1] - this.primaryColor[1]) * bassImpact);
    const b = Math.min(255, this.primaryColor[2] + (this.kickColor[2] - this.primaryColor[2]) * bassImpact);

    ringPaint.setColor(ck.Color(r, g, b, this.opacity));
    canvas.drawPath(path, ringPaint);

    // Núcleo branco brilhante para intensificar o Unreal Bloom
    if (this.coreGlow) {
      const corePaint = new ck.Paint();
      corePaint.setAntiAlias(true);
      corePaint.setStyle(ck.PaintStyle.Stroke);
      corePaint.setStrokeWidth(2 * this.opacity);
      corePaint.setColor(ck.Color(255, 255, 255, 0.95 * this.opacity));
      canvas.drawPath(path, corePaint);
      corePaint.delete();
    }

    path.delete();
    ringPaint.delete();

    // Onda de Choque Interior (Kick Shockwave)
    if (this.shockwaveEnabled && bassImpact > 0.05) {
      const shockwavePaint = new ck.Paint();
      shockwavePaint.setAntiAlias(true);
      shockwavePaint.setStyle(ck.PaintStyle.Stroke);
      shockwavePaint.setStrokeWidth((2 + bassImpact * 5) * this.opacity);
      shockwavePaint.setColor(ck.Color(this.kickColor[0], this.kickColor[1], this.kickColor[2], bassImpact * 0.9 * this.opacity));

      const kickRadius = baseRadius * (0.65 + bassImpact * 0.35);
      canvas.drawCircle(centerX, centerY, kickRadius, shockwavePaint);
      shockwavePaint.delete();
    }
  }

  public getConfig(): Record<string, any> {
    return {
      baseRadiusRatio: this.baseRadiusRatio,
      kickExpansion: this.kickExpansion,
      deformationScale: this.deformationScale,
      strokeWidth: this.strokeWidth,
      rotationSpeed: this.rotationSpeed,
      primaryColor: this.primaryColor,
      kickColor: this.kickColor,
      coreGlow: this.coreGlow,
      shockwaveEnabled: this.shockwaveEnabled,
      opacity: this.opacity,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.baseRadiusRatio !== undefined) this.baseRadiusRatio = config.baseRadiusRatio;
    if (config.kickExpansion !== undefined) this.kickExpansion = config.kickExpansion;
    if (config.deformationScale !== undefined) this.deformationScale = config.deformationScale;
    if (config.strokeWidth !== undefined) this.strokeWidth = config.strokeWidth;
    if (config.rotationSpeed !== undefined) this.rotationSpeed = config.rotationSpeed;
    if (config.primaryColor !== undefined) this.primaryColor = config.primaryColor;
    if (config.kickColor !== undefined) this.kickColor = config.kickColor;
    if (config.coreGlow !== undefined) this.coreGlow = config.coreGlow;
    if (config.shockwaveEnabled !== undefined) this.shockwaveEnabled = config.shockwaveEnabled;
    if (config.opacity !== undefined) this.opacity = config.opacity;
  }
}
