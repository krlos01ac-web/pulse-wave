import { BaseLayer, type LayerRenderContext } from './BaseLayer';
import type { Image as SkImage } from 'canvaskit-wasm';

export class BackgroundLayer extends BaseLayer {
  public style: 'image' | 'grid' | 'gradient' | 'starfield' = 'image';
  public colorA: [number, number, number] = [15, 20, 40]; // RGB
  public colorB: [number, number, number] = [4, 6, 14];   // RGB
  public gridSize: number = 80;
  public pulseReactivity: number = 1.0;

  // Propriedades do modo Imagem (como no Vizzy.io)
  private skImage: SkImage | null = null;
  private imageSrc: string | null = null;
  public fitToScreen: boolean = true;
  public vignette: number = 0.2;
  public kickPulseScale: number = 0.04; // Leve zoom reativo no bumbo
  public reactToAudio: boolean = true;
  public scale: number = 1.0;
  public offsetX: number = 0;
  public offsetY: number = 0;
  public mirror: 'none' | 'horizontal' | 'vertical' = 'none';

  // Cache de shader de vinheta para performance
  private cachedVigShader: any = null;
  private cachedVigKey: string = '';

  // Starfield simulation
  private stars: Array<{ x: number; y: number; z: number; size: number }> = [];

  constructor(id: string = 'background-layer') {
    super(id, 'Image / Plano de Fundo');
    this.initStars();
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000 + 1,
        size: Math.random() * 2 + 1,
      });
    }
  }

  /**
   * Define uma imagem de fundo a partir de DataURL ou Base64
   */
  public setImageFromDataUrl(dataUrl: string, ck?: any): void {
    this.imageSrc = dataUrl;
    this.style = 'image';

    if (ck) {
      try {
        const base64 = dataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        if (this.skImage) {
          try {
            this.skImage.delete();
          } catch {}
        }
        this.skImage = ck.MakeImageFromEncoded(bytes);
      } catch (err) {
        console.error('Erro ao compilar imagem para Skia:', err);
      }
    }
  }

  public getImageSrc(): string | null {
    return this.imageSrc;
  }

  public render(ctx: LayerRenderContext): void {
    if (!this.enabled || this.opacity <= 0) return;

    const { ck, canvas, width, height, bassImpact } = ctx;

    // Se temos imagem pendente de compilação no Skia
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
        console.error('Erro ao decodificar imagem:', err);
      }
    }

    // =========================================================================
    // 1. MODO IMAGEM DE FUNDO (ESTILO VIZZY.IO)
    // =========================================================================
    if (this.style === 'image' && this.skImage) {
      const imgW = this.skImage.width();
      const imgH = this.skImage.height();

      const pulse = 1.0 + (this.reactToAudio ? bassImpact * this.kickPulseScale : 0);

      let drawW: number;
      let drawH: number;
      let drawX: number;
      let drawY: number;

      if (this.fitToScreen) {
        // Modo Cover: preenche todo o ecrã preservando proporção
        const s = Math.max(width / imgW, height / imgH) * pulse;
        drawW = imgW * s;
        drawH = imgH * s;
        drawX = (width - drawW) / 2 + this.offsetX;
        drawY = (height - drawH) / 2 + this.offsetY;
      } else {
        drawW = imgW * this.scale * pulse;
        drawH = imgH * this.scale * pulse;
        drawX = (width - drawW) / 2 + this.offsetX;
        drawY = (height - drawH) / 2 + this.offsetY;
      }

      const srcRect = ck.LTRBRect(0, 0, imgW, imgH);
      const dstRect = ck.LTRBRect(drawX, drawY, drawX + drawW, drawY + drawH);

      const imgPaint = new ck.Paint();
      imgPaint.setAntiAlias(true);
      imgPaint.setAlphaf(Math.max(0, Math.min(1, this.opacity)));

      canvas.save();

      // Espelhamento opcional
      if (this.mirror === 'horizontal') {
        canvas.translate(width, 0);
        canvas.scale(-1, 1);
      } else if (this.mirror === 'vertical') {
        canvas.translate(0, height);
        canvas.scale(1, -1);
      }

      canvas.drawImageRect(this.skImage, srcRect, dstRect, imgPaint);
      canvas.restore();
      imgPaint.delete();

      // Efeito de Vinheta (Vignette) com cache de shader
      if (this.vignette > 0) {
        const key = `${width}_${height}_${this.vignette}`;
        if (!this.cachedVigShader || this.cachedVigKey !== key) {
          if (this.cachedVigShader) {
            try { this.cachedVigShader.delete(); } catch {}
          }
          const radius = Math.max(width, height) * 0.75;
          this.cachedVigShader = ck.Shader.MakeRadialGradient(
            [width / 2, height / 2],
            radius,
            [
              ck.Color(0, 0, 0, 0),
              ck.Color(0, 0, 0, Math.min(1.0, this.vignette * 1.3)),
            ],
            [0.35, 1.0],
            ck.TileMode.Clamp
          );
          this.cachedVigKey = key;
        }

        const vigPaint = new ck.Paint();
        vigPaint.setAntiAlias(true);
        vigPaint.setStyle(ck.PaintStyle.Fill);
        vigPaint.setShader(this.cachedVigShader);
        canvas.drawRect(ck.LTRBRect(0, 0, width, height), vigPaint);
        vigPaint.delete();
      }

      return;
    }

    // =========================================================================
    // 2. MODOS VETORIAIS (FALLBACK SE NENHUMA IMAGEM FOR CARREGADA)
    // =========================================================================
    const paint = new ck.Paint();
    paint.setAntiAlias(true);

    if (this.style === 'grid' || (this.style === 'image' && !this.skImage)) {
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(1);

      const r = Math.min(255, this.colorA[0] + bassImpact * 25 * this.pulseReactivity);
      const g = Math.min(255, this.colorA[1] + bassImpact * 20 * this.pulseReactivity);
      const b = Math.min(255, this.colorA[2] + bassImpact * 40 * this.pulseReactivity);

      paint.setColor(ck.Color(r, g, b, 0.35 * this.opacity));

      for (let x = 0; x < width; x += this.gridSize) {
        canvas.drawLine(x, 0, x, height, paint);
      }
      for (let y = 0; y < height; y += this.gridSize) {
        canvas.drawLine(0, y, width, y, paint);
      }
    } else if (this.style === 'gradient') {
      paint.setStyle(ck.PaintStyle.Fill);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.max(width, height) * 0.7;

      const shader = ck.Shader.MakeRadialGradient(
        [centerX, centerY],
        radius,
        [
          ck.Color(this.colorA[0], this.colorA[1], this.colorA[2], this.opacity),
          ck.Color(this.colorB[0], this.colorB[1], this.colorB[2], this.opacity),
        ],
        [0, 1],
        ck.TileMode.Clamp
      );

      paint.setShader(shader);
      canvas.drawRect(ck.LTRBRect(0, 0, width, height), paint);
      shader.delete();
    } else if (this.style === 'starfield') {
      paint.setStyle(ck.PaintStyle.Fill);
      const centerX = width / 2;
      const centerY = height / 2;
      const speed = 2.0 + bassImpact * 12.0 * this.pulseReactivity;

      for (const s of this.stars) {
        s.z -= speed;
        if (s.z <= 0) {
          s.z = 1000;
          s.x = (Math.random() - 0.5) * width * 1.5;
          s.y = (Math.random() - 0.5) * height * 1.5;
        }

        const k = 400 / s.z;
        const px = centerX + s.x * k;
        const py = centerY + s.y * k;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const alpha = Math.min(1.0, (1 - s.z / 1000) * this.opacity);
          paint.setColor(ck.Color(200, 225, 255, alpha));
          canvas.drawCircle(px, py, s.size * (1 + bassImpact * 0.5), paint);
        }
      }
    }

    paint.delete();
  }

  public getConfig(): Record<string, any> {
    return {
      style: this.style,
      colorA: this.colorA,
      colorB: this.colorB,
      gridSize: this.gridSize,
      pulseReactivity: this.pulseReactivity,
      fitToScreen: this.fitToScreen,
      vignette: this.vignette,
      kickPulseScale: this.kickPulseScale,
      reactToAudio: this.reactToAudio,
      scale: this.scale,
      mirror: this.mirror,
      opacity: this.opacity,
      imageSrc: this.imageSrc,
    };
  }

  public setConfig(config: Record<string, any>): void {
    if (config.style !== undefined) this.style = config.style;
    if (config.colorA !== undefined) this.colorA = config.colorA;
    if (config.colorB !== undefined) this.colorB = config.colorB;
    if (config.gridSize !== undefined) this.gridSize = config.gridSize;
    if (config.pulseReactivity !== undefined) this.pulseReactivity = config.pulseReactivity;
    if (config.fitToScreen !== undefined) this.fitToScreen = config.fitToScreen;
    if (config.vignette !== undefined) this.vignette = config.vignette;
    if (config.kickPulseScale !== undefined) this.kickPulseScale = config.kickPulseScale;
    if (config.reactToAudio !== undefined) this.reactToAudio = config.reactToAudio;
    if (config.scale !== undefined) this.scale = config.scale;
    if (config.mirror !== undefined) this.mirror = config.mirror;
    if (config.opacity !== undefined) this.opacity = config.opacity;
    if (config.imageSrc !== undefined) this.imageSrc = config.imageSrc;
  }
}
