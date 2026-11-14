/**
 * ParticleEngine: Motor 3D de Partículas Audio-Reativas inspirado no Vizzy.io.
 * Suporta texturas procedurais personalizadas, limites temporais, espelhamento bilateral e beat explosion.
 */

import * as THREE from 'three';

export type ParticleShape =
  | 'glowing-orb'
  | 'sparkle'
  | 'glow-dot'
  | 'smoke-1'
  | 'smoke-2'
  | 'crescent'
  | 'square'
  | 'circle'
  | 'custom';

export type ParticleMovementStyle = 'starfield' | 'snow' | 'orbit';

export interface ParticleConfig {
  enabled: boolean;
  amount: number;
  shape: ParticleShape;
  color: string;
  movementStyle: ParticleMovementStyle;
  speed: number;
  reactToAudio: boolean;
  beatReactivity: number;
  opacityMin: number;
  opacityMax: number;
  sizeMin: number;
  sizeMax: number;
  fadeInOpacity: boolean;
  fadeOutOpacity: boolean;
  mirror: boolean;
  constantSize: boolean;
  frontLimit: number;
  frontLimitTime: number;
  backLimit: number;
  backLimitTime: number;
  alphaMultiplier: number;
}

export class ParticleEngine {
  private scene: THREE.Scene;
  private pointsMesh: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.PointsMaterial | null = null;

  private basePositions: Float32Array = new Float32Array(0);
  private randomPhases: Float32Array = new Float32Array(0);

  private textureCache: Map<string, THREE.Texture> = new Map();
  private customTextureUrl: string | null = null;

  public config: ParticleConfig = {
    enabled: true,
    amount: 1000,
    shape: 'glowing-orb',
    color: '#ffffff',
    movementStyle: 'starfield',
    speed: 1.0,
    reactToAudio: true,
    beatReactivity: 1.0,
    opacityMin: 0.0,
    opacityMax: 1.0,
    sizeMin: 0.2,
    sizeMax: 0.6,
    fadeInOpacity: true,
    fadeOutOpacity: true,
    mirror: true,
    constantSize: false,
    frontLimit: 5,
    frontLimitTime: 10,
    backLimit: 500,
    backLimitTime: 10,
    alphaMultiplier: 1.0,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initTextures();
    this.rebuild();
  }

  /**
   * Gera texturas 128x128 procedurais de alta definição para as diferentes formas de partículas
   */
  private initTextures(): void {
    const shapes: ParticleShape[] = [
      'glow-dot',
      'sparkle',
      'glowing-orb',
      'smoke-1',
      'smoke-2',
      'crescent',
      'square',
      'circle',
    ];

    for (const shape of shapes) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 128);

      const cx = 64;
      const cy = 64;

      if (shape === 'glow-dot') {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'sparkle') {
        // Estrela / Sparkle de 8 pontas
        ctx.save();
        ctx.translate(cx, cy);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;

        // Raio horizontal e vertical longo
        ctx.beginPath();
        ctx.ellipse(0, 0, 62, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, 5, 62, 0, 0, Math.PI * 2);
        ctx.fill();

        // Raios diagonais menores
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 36, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, 4, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (shape === 'glowing-orb') {
        // Orbe brilhante com anel externo (exatamente como na imagem do utilizador)
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 58);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.5, 'rgba(100, 200, 255, 0.5)');
        grad.addColorStop(0.85, 'rgba(40, 150, 255, 0.25)');
        grad.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'smoke-1' || shape === 'smoke-2') {
        // Nuvem orgânica suave
        const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 55);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        grad.addColorStop(0.4, 'rgba(240, 245, 255, 0.4)');
        grad.addColorStop(1, 'rgba(200, 220, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 8, 38, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 5, 34, 0, Math.PI * 2);
        ctx.arc(cx - 5, cy + 12, 36, 0, Math.PI * 2);
        ctx.arc(cx + 10, cy + 10, 32, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === 'crescent') {
        // Lua crescente
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx + 18, cy - 10, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (shape === 'square') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18, 18, 92, 92);
      } else if (shape === 'circle') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fill();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      this.textureCache.set(shape, texture);
    }
  }

  public setCustomImage(dataUrl: string): void {
    this.customTextureUrl = dataUrl;
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      this.textureCache.set('custom', tex);
      this.config.shape = 'custom';
      this.updateMaterial();
    };
    img.src = dataUrl;
  }

  public getCustomTextureUrl(): string | null {
    return this.customTextureUrl;
  }

  public getShapeTexture(shape: ParticleShape): THREE.Texture | undefined {
    return this.textureCache.get(shape);
  }

  /**
   * Recria a malha de partículas com a contagem e estilo selecionados
   */
  public rebuild(): void {
    if (this.pointsMesh) {
      this.scene.remove(this.pointsMesh);
      this.geometry?.dispose();
      this.material?.dispose();
    }

    const count = Math.max(10, Math.min(3000, this.config.amount));
    this.geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.basePositions = new Float32Array(count * 3);
    this.randomPhases = new Float32Array(count);

    const baseColor = new THREE.Color(this.config.color || '#ffffff');
    const style = this.config.movementStyle || 'starfield';

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let x = 0;
      let y = 0;
      let z = 0;

      if (style === 'starfield') {
        // Starfield 3D: Distribuição em cone/túnel radial projetado do centro para a tela
        const angle = Math.random() * Math.PI * 2;
        // Maior concentração no centro que se expande para as bordas em perspectiva
        const dist = 30 + Math.pow(Math.random(), 0.75) * 650;
        x = Math.cos(angle) * dist;
        y = Math.sin(angle) * dist * 0.65; // Proporção widescreen 16:9
        z = 0;
      } else if (style === 'snow') {
        // Neve: Distribuição horizontal ampla com camadas multi-profundidade
        x = (Math.random() - 0.5) * 1700;
        y = (Math.random() - 0.5) * 1100;
        z = (Math.random() - 0.5) * 450; // Variação de planos em Z
      } else {
        // Orbit: Disco elíptico 3D clássico em torno do visualizador
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.pow(Math.random(), 0.8) * 580;
        x = Math.cos(angle) * dist;
        y = Math.sin(angle) * dist * 0.75;
        z = 0;
      }

      if (this.config.mirror) {
        // Espelhamento bilateral ao longo do eixo vertical
        if (i % 2 === 1 && i > 0) {
          x = -positions[(i - 1) * 3];
          y = positions[(i - 1) * 3 + 1];
          z = positions[(i - 1) * 3 + 2];
        }
      }

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      this.basePositions[idx] = x;
      this.basePositions[idx + 1] = y;
      this.basePositions[idx + 2] = z;

      // Fase única normalizada (0.0 a 1.0) para fluxo contínuo
      if (this.config.mirror && i % 2 === 1 && i > 0) {
        this.randomPhases[i] = this.randomPhases[i - 1]; // Partículas espelhadas sincronizadas
      } else {
        this.randomPhases[i] = Math.random();
      }

      colors[idx] = baseColor.r;
      colors[idx + 1] = baseColor.g;
      colors[idx + 2] = baseColor.b;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const activeTexture = this.textureCache.get(this.config.shape) || this.textureCache.get('glowing-orb');

    const avgSize = this.config.constantSize
      ? this.config.sizeMax * 18
      : ((this.config.sizeMin + this.config.sizeMax) * 0.5) * 18;

    this.material = new THREE.PointsMaterial({
      size: Math.max(3, avgSize),
      map: activeTexture,
      transparent: true,
      opacity: 1.0, // Controlado finamente via cores dos vértices e AdditiveBlending
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,  // CRÍTICO: Nunca é ocultada pelo plano 2D de fundo
      depthWrite: false, // As partículas não criam oclusão mútua
      sizeAttenuation: true, // Efeito 3D natural: partículas mais próximas são maiores
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.pointsMesh.renderOrder = 10; // Sempre desenhada sobre o plano 2D
    this.pointsMesh.visible = this.config.enabled;
    this.scene.add(this.pointsMesh);
  }

  public updateMaterial(): void {
    if (!this.material) return;
    const activeTexture = this.textureCache.get(this.config.shape) || this.textureCache.get('glowing-orb');
    if (activeTexture) {
      this.material.map = activeTexture;
      this.material.needsUpdate = true;
    }

    const avgSize = this.config.constantSize
      ? this.config.sizeMax * 18
      : ((this.config.sizeMin + this.config.sizeMax) * 0.5) * 18;

    this.material.size = Math.max(3, avgSize);
    this.material.opacity = 1.0;
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this.material.blending = THREE.AdditiveBlending;
    this.material.needsUpdate = true;

    // Atualiza cores dos vértices
    if (this.geometry) {
      const count = this.geometry.attributes.position.count;
      const colors = this.geometry.attributes.color.array as Float32Array;
      const baseColor = new THREE.Color(this.config.color || '#ffffff');
      const opacityMax = Math.max(0, Math.min(1, this.config.opacityMax));
      const alphaMult = Math.max(0.1, this.config.alphaMultiplier);
      const effectiveAlpha = opacityMax * alphaMult;

      for (let i = 0; i < count; i++) {
        colors[i * 3] = baseColor.r * effectiveAlpha;
        colors[i * 3 + 1] = baseColor.g * effectiveAlpha;
        colors[i * 3 + 2] = baseColor.b * effectiveAlpha;
      }
      this.geometry.attributes.color.needsUpdate = true;
    }

    if (this.pointsMesh) {
      this.pointsMesh.renderOrder = 10;
      this.pointsMesh.visible = this.config.enabled;
    }
  }

  /**
   * Atualização determinística por frame: suporta os 3 estilos de movimento
   * 1) Starfield 3D (em direção à tela)
   * 2) Neve (queda suave com gravidade e vento)
   * 3) Orbital (constelação tridimensional)
   */
  public update(time: number, bassImpact: number, spectrum: Float32Array): void {
    if (!this.config.enabled || !this.pointsMesh || !this.geometry) {
      if (this.pointsMesh) this.pointsMesh.visible = false;
      return;
    }

    this.pointsMesh.visible = true;

    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;
    const base = this.basePositions;
    const count = this.geometry.attributes.position.count;

    const baseColor = new THREE.Color(this.config.color || '#ffffff');
    const opacityMin = Math.max(0, Math.min(1, this.config.opacityMin));
    const opacityMax = Math.max(0, Math.min(1, this.config.opacityMax));
    const alphaMult = Math.max(0.1, this.config.alphaMultiplier);
    const fadeIn = this.config.fadeInOpacity;
    const fadeOut = this.config.fadeOutOpacity;
    const speed = Math.max(0.1, this.config.speed || 1.0);

    // Modulação de reação ao áudio configurável pelo usuário
    const isAudioReactive = this.config.reactToAudio ?? true;
    const beatSens = isAudioReactive ? (this.config.beatReactivity ?? 1.0) : 0;
    const effectiveBass = bassImpact * beatSens;

    // Energia de agudos para micro-turbulência harmónica (apenas se reactToAudio estiver ativo)
    let midHighEnergy = 0;
    if (isAudioReactive) {
      const specLen = spectrum.length;
      for (let b = Math.floor(specLen * 0.3); b < specLen; b++) {
        midHighEnergy += spectrum[b];
      }
      midHighEnergy = (midHighEnergy / Math.max(1, specLen * 0.7)) * 20.0 * beatSens;
    }

    const style = this.config.movementStyle || 'starfield';

    if (style === 'starfield') {
      // =========================================================================
      // ESTILO 1: STARFIELD 3D COM PROJEÇÃO PERSPECTIVA (EM DIREÇÃO À TELA)
      // =========================================================================
      const zNear = 380;   // Limite frontal perto da câmera
      const zFar = -1200;  // Ponto de fuga profundo no espaço
      const zRange = zNear - zFar;
      const travelTime = Math.max(0.8, (this.config.backLimitTime || 6) / speed);

      // Leve rotação de vórtice no eixo Z (efeito túnel espacial em direção ao espectador)
      this.pointsMesh.rotation.z = time * 0.05 * speed;
      this.pointsMesh.rotation.y = Math.sin(time * 0.02) * 0.03;
      this.pointsMesh.rotation.x = Math.cos(time * 0.02) * 0.03;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const phase = this.randomPhases[i];

        // Progresso contínuo de 0.0 (fundo) a 1.0 (passando pela tela)
        let progress = (time / travelTime + phase) % 1.0;
        if (progress < 0) progress += 1.0;

        // Impulso do kick acelera as estrelas para a frente no bumbo
        const kickThrust = effectiveBass * 120 * Math.pow(progress, 1.4);
        const currentZ = zFar + progress * zRange + kickThrust;

        // Projeção em perspectiva: quanto mais próxima do ecrã, mais expande radialmente
        const perspectiveFactor = Math.pow(progress, 2.2) * 4.2 + 0.3;
        const kickExpansion = 1.0 + effectiveBass * 0.45 * progress;

        const bx = base[idx] * perspectiveFactor * kickExpansion;
        const by = base[idx + 1] * perspectiveFactor * kickExpansion;

        // Fade in suave ao nascer no fundo e fade out ao passar rente à tela
        let fade = 1.0;
        if (fadeIn && progress < 0.15) {
          fade *= progress / 0.15;
        }
        if (fadeOut && progress > 0.85) {
          fade *= (1.0 - progress) / 0.15;
        }
        fade = Math.max(0, Math.min(1, fade));

        const particleAlpha = (opacityMin + (opacityMax - opacityMin) * fade) * alphaMult;
        const boostedAlpha = Math.min(1.0, particleAlpha * (0.8 + progress * 0.4 + effectiveBass * 0.35));

        colors[idx] = baseColor.r * boostedAlpha;
        colors[idx + 1] = baseColor.g * boostedAlpha;
        colors[idx + 2] = baseColor.b * boostedAlpha;

        positions[idx] = bx;
        positions[idx + 1] = by;
        positions[idx + 2] = currentZ;
      }

      // Tamanho das estrelas cresce à medida que se aproximam da tela
      if (this.material) {
        const avgSize = this.config.constantSize
          ? this.config.sizeMax * 20
          : ((this.config.sizeMin + this.config.sizeMax) * 0.5) * 20;
        this.material.size = Math.max(3, avgSize * (1.0 + effectiveBass * 0.45));
      }

    } else if (style === 'snow') {
      // =========================================================================
      // ESTILO 2: NEVE (SNOW FALL COM GRAVIDADE E VENTO ORGÂNICO)
      // =========================================================================
      const yTop = 550;      // Acima do topo da tela
      const yBottom = -550;  // Abaixo do rodapé da tela
      const yRange = yTop - yBottom;
      const travelTime = Math.max(2, (this.config.backLimitTime || 10) / speed);

      // Sem rotação global para manter a queda vertical elegante
      this.pointsMesh.rotation.set(0, 0, 0);

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const phase = this.randomPhases[i];
        // Cada floco tem um peso e velocidade de descida ligeiramente diferentes
        const flakeWeight = 0.75 + (i % 5) * 0.12;

        let progress = ((time * flakeWeight) / travelTime + phase) % 1.0;
        if (progress < 0) progress += 1.0;

        const currentY = yTop - progress * yRange;

        // Vento e oscilação horizontal orgânica dos flocos
        const sway = Math.sin(time * 1.5 + phase * 6.28) * 32 + Math.cos(time * 0.8 + phase * 3.14) * 16;
        // Rajada de vento lateral quando há impacto nos graves
        const windGust = Math.sin(time * 0.4) * 40 + effectiveBass * 30;

        // Fade in suave ao entrar no topo e fade out ao atingir o solo
        let fade = 1.0;
        if (fadeIn && progress < 0.12) {
          fade *= progress / 0.12;
        }
        if (fadeOut && progress > 0.88) {
          fade *= (1.0 - progress) / 0.12;
        }
        fade = Math.max(0, Math.min(1, fade));

        // Brilho cintilante de neve (twinkle)
        const twinkle = 0.85 + Math.sin(time * 3.5 + phase * 10) * 0.15;
        const particleAlpha = (opacityMin + (opacityMax - opacityMin) * fade) * alphaMult;
        const boostedAlpha = Math.min(1.0, particleAlpha * twinkle * (1.0 + effectiveBass * 0.25));

        colors[idx] = baseColor.r * boostedAlpha;
        colors[idx + 1] = baseColor.g * boostedAlpha;
        colors[idx + 2] = baseColor.b * boostedAlpha;

        positions[idx] = base[idx] + sway + windGust;
        positions[idx + 1] = currentY;
        positions[idx + 2] = base[idx + 2]; // Camada de profundidade distribuída
      }

      if (this.material) {
        const avgSize = this.config.constantSize
          ? this.config.sizeMax * 16
          : ((this.config.sizeMin + this.config.sizeMax) * 0.5) * 16;
        this.material.size = Math.max(2.5, avgSize * (1.0 + effectiveBass * 0.25));
      }

    } else {
      // =========================================================================
      // ESTILO 3: ORBITAL / CONSTELAÇÃO (O ESTILO ATUAL)
      // =========================================================================
      const zFront = this.config.frontLimit <= 20 ? this.config.frontLimit * 60 : this.config.frontLimit;
      const zBack = -(this.config.backLimit <= 20 ? this.config.backLimit * 60 : this.config.backLimit);
      const zRange = Math.max(100, zFront - zBack);
      const travelTime = Math.max(1, (this.config.backLimitTime || 10) / speed);

      // Oscilação suave da constelação
      this.pointsMesh.rotation.z = Math.sin(time * 0.04) * 0.07;
      this.pointsMesh.rotation.y = Math.sin(time * 0.03) * 0.05;
      this.pointsMesh.rotation.x = Math.sin(time * 0.025) * 0.04;

      const kickScale = 1.0 + effectiveBass * 0.35;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const phase = this.randomPhases[i];

        let progress = (time / travelTime + phase) % 1.0;
        if (progress < 0) progress += 1.0;

        const currentZ = zBack + progress * zRange;

        let fade = 1.0;
        if (fadeIn && progress < 0.18) {
          fade *= progress / 0.18;
        }
        if (fadeOut && progress > 0.82) {
          fade *= (1.0 - progress) / 0.18;
        }
        fade = Math.max(0, Math.min(1, fade));

        const particleAlpha = (opacityMin + (opacityMax - opacityMin) * fade) * alphaMult;
        const boostedAlpha = Math.min(1.0, particleAlpha * (1.0 + effectiveBass * 0.35));

        colors[idx] = baseColor.r * boostedAlpha;
        colors[idx + 1] = baseColor.g * boostedAlpha;
        colors[idx + 2] = baseColor.b * boostedAlpha;

        const bx = base[idx] * kickScale;
        const by = base[idx + 1] * kickScale;

        const waveX = Math.cos(time * 1.6 + phase * 6.28) * (8 + midHighEnergy * 0.4);
        const waveY = Math.sin(time * 1.9 + phase * 6.28) * (10 + midHighEnergy * 0.5);

        positions[idx] = bx + waveX;
        positions[idx + 1] = by + waveY;
        positions[idx + 2] = currentZ;
      }

      if (this.material) {
        const avgSize = this.config.constantSize
          ? this.config.sizeMax * 18
          : ((this.config.sizeMin + this.config.sizeMax) * 0.5) * 18;
        this.material.size = Math.max(3, avgSize * (1.0 + effectiveBass * 0.35));
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public setConfig(cfg: Partial<ParticleConfig>): void {
    const styleChanged = cfg.movementStyle !== undefined && cfg.movementStyle !== this.config.movementStyle;
    const amountChanged = cfg.amount !== undefined && cfg.amount !== this.config.amount;
    const mirrorChanged = cfg.mirror !== undefined && cfg.mirror !== this.config.mirror;

    Object.assign(this.config, cfg);

    if (styleChanged || amountChanged || mirrorChanged) {
      this.rebuild();
    } else {
      this.updateMaterial();
    }
  }

  public getConfig(): ParticleConfig {
    return { ...this.config };
  }
}
