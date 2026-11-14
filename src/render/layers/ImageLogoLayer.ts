import { BaseLayer, type LayerRenderContext } from './BaseLayer';
import type { Image as SkImage } from 'canvaskit-wasm';

export class ImageLogoLayer extends BaseLayer {
  public radius: number = 80;
  public kickScale: number = 0.35; // Expansão no bumbo
  public autoRotate: boolean = true;
  public rotationSpeed: number = 0.3;
  public borderColor: [number, number, number] = [0, 220, 255];
  public borderWidth: number = 4;
  public offsetX: number = 0;
  public offsetY: number = 0;

  private skImage: SkImage | null = null;
  private imageSrc: string | null = null;

  constructor(id: string = 'image-logo-layer') {
    super(id, 'Logo / Capa do Álbum');
  }

  public getImageSrc(): string | null {
    return this.imageSrc;
  }

  public clearImage(): void {
    if (this.skImage) {
      try {
        this.skImage.delete();
      } catch {}
      this.skImage = null;
    }
    this.imageSrc = null;
  }

  public setImageFromDataUrl(dataUrl: string, ck?: any): void {
    try {
      this.imageSrc = dataUrl;
      if (this.skImage) {
        try {
          this.skImage.delete();
        } catch {}
        this.skImage = null;
      }
      if (ck) {
        const base64 = dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        this.skImage = ck.MakeImageFromEncoded(bytes);
      }
    } catch (err) {
      console.error('Erro ao decodificar imagem para Skia:', err);
    }
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, bassImpact, cumulative } = ctx;

    // Decodificação preguiçosa se ck não estava disponível no momento do upload
    if (this.imageSrc && !this.skImage && ck) {
      try {
        const base64 = this.imageSrc.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        this.skImage = ck.MakeImageFromEncoded(bytes);
      } catch (err) {
        console.error('Erro ao decodificar imagem para Skia:', err);
      }
    }

    const centerX = width / 2 + this.offsetX;
    const centerY = height / 2 - 35 + this.offsetY;

    const scale = 1.0 + bassImpact * this.kickScale;
    const currentRadius = this.radius * scale;

    canvas.save();
    canvas.translate(centerX, centerY);

    if (this.autoRotate) {
      canvas.rotate((cumulative * this.rotationSpeed * 180) / Math.PI, 0, 0);
    }

    // Se temos imagem carregada, desenha com recorte circular
    if (this.skImage) {
      canvas.save();
      const clipPath = new ck.PathBuilder().addCircle(0, 0, currentRadius).detachAndDelete();
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true);
      clipPath.delete();

      const imgPaint = new ck.Paint();
      imgPaint.setAntiAlias(true);
      const srcRect = ck.LTRBRect(0, 0, this.skImage.width(), this.skImage.height());
      const dstRect = ck.LTRBRect(-currentRadius, -currentRadius, currentRadius, currentRadius);

      canvas.drawImageRect(this.skImage, srcRect, dstRect, imgPaint);
      imgPaint.delete();
      canvas.restore();
    } else {
      // Placeholder gráfico elegante de disco de vinil / núcleo se nenhuma imagem for carregada
      const discPaint = new ck.Paint();
      discPaint.setAntiAlias(true);
      discPaint.setStyle(ck.PaintStyle.Fill);
      discPaint.setColor(ck.Color(16, 22, 38, 0.95 * this.opacity));
      canvas.drawCircle(0, 0, currentRadius, discPaint);

      const groovePaint = new ck.Paint();
      groovePaint.setAntiAlias(true);
      groovePaint.setStyle(ck.PaintStyle.Stroke);
      groovePaint.setStrokeWidth(1);
      groovePaint.setColor(ck.Color(60, 85, 140, 0.4 * this.opacity));
      canvas.drawCircle(0, 0, currentRadius * 0.75, groovePaint);
      canvas.drawCircle(0, 0, currentRadius * 0.5, groovePaint);
      canvas.drawCircle(0, 0, currentRadius * 0.25, groovePaint);

      discPaint.delete();
      groovePaint.delete();
    }

    // Borda exterior neon
    if (this.borderWidth > 0) {
      const borderPaint = new ck.Paint();
      borderPaint.setAntiAlias(true);
      borderPaint.setStyle(ck.PaintStyle.Stroke);
      borderPaint.setStrokeWidth((this.borderWidth + bassImpact * 3) * this.opacity);
      borderPaint.setColor(
        ck.Color(this.borderColor[0], this.borderColor[1], this.borderColor[2], this.opacity)
      );
      canvas.drawCircle(0, 0, currentRadius, borderPaint);
      borderPaint.delete();
    }

    canvas.restore();
  }

  public getConfig(): Record<string, any> {
    return {
      radius: this.radius,
      kickScale: this.kickScale,
      autoRotate: this.autoRotate,
      rotationSpeed: this.rotationSpeed,
      borderColor: this.borderColor,
      borderWidth: this.borderWidth,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      imageSrc: this.imageSrc,
      opacity: this.opacity,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.radius !== undefined) this.radius = config.radius;
    if (config.kickScale !== undefined) this.kickScale = config.kickScale;
    if (config.autoRotate !== undefined) this.autoRotate = config.autoRotate;
    if (config.rotationSpeed !== undefined) this.rotationSpeed = config.rotationSpeed;
    if (config.borderColor !== undefined) this.borderColor = config.borderColor;
    if (config.borderWidth !== undefined) this.borderWidth = config.borderWidth;
    if (config.offsetX !== undefined) this.offsetX = config.offsetX;
    if (config.offsetY !== undefined) this.offsetY = config.offsetY;
    if (config.opacity !== undefined) this.opacity = config.opacity;
  }
}
