import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ChromaticAberrationShader, VignetteGrainShader } from './shaders/CustomShaders';
import { ParticleEngine } from './ParticleEngine';
import type { CanvasKit, Surface, Canvas } from 'canvaskit-wasm';

declare global {
  interface Window {
    CanvasKitInit?: (opts?: any) => Promise<CanvasKit>;
  }
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
}

export class FboHybridRenderer {
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;
  private pixelRatio: number;

  // Three.js Core
  private threeRenderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;

  // Passes de Efeitos
  private bloomPass: UnrealBloomPass;
  private chromaticPass: ShaderPass;
  private vignettePass: ShaderPass;

  // Render Target & Texture Bridge
  private displayPlaneMesh: THREE.Mesh;
  private skiaCanvasElement: HTMLCanvasElement;
  private skiaTexture: THREE.CanvasTexture;

  // Sistema de Partículas 3D Avançado
  public particleEngine: ParticleEngine;

  // Skia (CanvasKit) Core
  private canvasKit!: CanvasKit;
  private skSurface!: Surface;
  private skCanvas!: Canvas;

  private isReady: boolean = false;

  // Parâmetros configuráveis
  public chromaticAberrationEnabled: boolean = true;

  public get particlesEnabled(): boolean {
    return this.particleEngine.config.enabled;
  }

  public set particlesEnabled(val: boolean) {
    this.particleEngine.config.enabled = val;
    this.particleEngine.updateMaterial();
  }

  constructor(options: RendererOptions) {
    this.canvas = options.canvas;
    this.width = options.width;
    this.height = options.height;
    this.pixelRatio = options.pixelRatio || Math.min(window.devicePixelRatio, 2);

    // 1. Inicializa o WebGLRenderer do Three.js
    this.threeRenderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.threeRenderer.setSize(this.width, this.height, false);
    this.threeRenderer.setPixelRatio(this.pixelRatio);
    this.threeRenderer.setClearColor(0x05050a, 1);
    this.threeRenderer.autoClear = false;

    // 2. Cena 3D e Câmara
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 4000);
    const initialCameraZ = (this.height / 2) / Math.tan((45 * Math.PI) / 360);
    this.camera.position.set(0, 0, initialCameraZ);

    // 3. Sistema de Partículas 3D Avançado (Vizzy Style)
    this.particleEngine = new ParticleEngine(this.scene);

    // 4. Criação da superfície Skia em memória
    const renderW = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const renderH = Math.max(1, Math.floor(this.height * this.pixelRatio));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = renderW;
    offCanvas.height = renderH;
    this.skiaCanvasElement = offCanvas;

    // 5. Ponte de Textura GPU
    this.skiaTexture = new THREE.CanvasTexture(this.skiaCanvasElement);
    this.skiaTexture.minFilter = THREE.LinearFilter;
    this.skiaTexture.magFilter = THREE.LinearFilter;
    this.skiaTexture.generateMipmaps = false;

    // 6. Malha de Projeção no Espaço 3D
    const planeGeo = new THREE.PlaneGeometry(this.width, this.height);
    const planeMat = new THREE.MeshBasicMaterial({
      map: this.skiaTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    this.displayPlaneMesh = new THREE.Mesh(planeGeo, planeMat);
    this.displayPlaneMesh.renderOrder = 0; // O plano de composição 2D é sempre desenhado na base
    this.scene.add(this.displayPlaneMesh);

    // 7. Pipeline de Pós-Processamento (UnrealBloom + ChromaticAberration + Vignette)
    this.composer = new EffectComposer(this.threeRenderer);
    this.composer.renderToScreen = true;

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Pass 1: Bloom Físico (Otimizado a meia-resolução: 4x mais rápido na GPU sem perda de qualidade)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(this.width / 2), Math.floor(this.height / 2)),
      0.85, // Força equilibrada
      0.35, // Raio
      0.82 // Threshold alto para NÃO queimar fotos/imagens de fundo
    );
    this.composer.addPass(this.bloomPass);

    // Pass 2: Aberração Cromática Reativa
    this.chromaticPass = new ShaderPass(ChromaticAberrationShader);
    this.composer.addPass(this.chromaticPass);

    // Pass 3: Vinheta Cinematográfica e Grain
    this.vignettePass = new ShaderPass(VignetteGrainShader);
    this.composer.addPass(this.vignettePass);
  }

  /**
   * Inicializa o binário WebAssembly do CanvasKit e prepara a superfície GPU do Skia
   */
  public async init(): Promise<void> {
    const initFn = window.CanvasKitInit;
    if (typeof initFn !== 'function') {
      throw new Error(
        'CanvasKitInit não foi encontrado no objeto global window. Verifique se <script src="/canvaskit.js"> está presente no index.html.'
      );
    }

    this.canvasKit = await initFn({
      locateFile: (file: string) => `/${file}`,
    });

    const surface =
      this.canvasKit.MakeSWCanvasSurface(this.skiaCanvasElement) ||
      this.canvasKit.MakeWebGLCanvasSurface(this.skiaCanvasElement, this.canvasKit.ColorSpace.SRGB);

    if (!surface) {
      throw new Error('Falha ao criar superfície CanvasKit para o renderizador.');
    }
    this.skSurface = surface;
    this.skCanvas = this.skSurface.getCanvas();
    this.isReady = true;
  }

  /**
   * Renderiza a frame do Skia, sincroniza a textura e executa o pós-processamento Three.js
   */
  public renderFrame(
    drawSkiaCallback: (ck: CanvasKit, canvas: Canvas, width: number, height: number, time: number) => void,
    time: number,
    bassImpact: number = 0,
    spectrum?: Float32Array
  ): void {
    if (!this.isReady) return;

    const renderW = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const renderH = Math.max(1, Math.floor(this.height * this.pixelRatio));

    // 1. O Skia limpa e desenha os elementos vetoriais diretamente no buffer
    this.skCanvas.clear(this.canvasKit.TRANSPARENT);
    drawSkiaCallback(this.canvasKit, this.skCanvas, renderW, renderH, time);
    this.skSurface.flush();

    // 2. Atualiza a textura na GPU para o Three.js
    this.skiaTexture.needsUpdate = true;

    // 3. Atualização determinística do Motor de Partículas 3D Avançado
    if (this.particleEngine) {
      this.particleEngine.update(time, bassImpact, spectrum || new Float32Array(0));
    }

    // 4. Manter o plano do visualizador perfeitamente alinhado com a câmara (sem distorção 3D)
    this.displayPlaneMesh.rotation.set(0, 0, 0);
    this.displayPlaneMesh.position.set(0, 0, 0);

    // 5. Atualização de Uniforms dos Shaders de Pós-Processamento
    if (this.chromaticAberrationEnabled) {
      this.chromaticPass.enabled = true;
      this.chromaticPass.uniforms.uBassImpact.value = bassImpact;
    } else {
      this.chromaticPass.enabled = false;
    }
    this.vignettePass.uniforms.uTime.value = time;

    // 6. Executa o pipeline de pós-processamento completo
    this.composer.render();
  }

  public setBloomConfig(strength: number, radius: number, threshold: number): void {
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  public setSize(width: number, height: number, pixelRatio?: number): void {
    this.width = width;
    this.height = height;

    if (pixelRatio !== undefined) {
      this.pixelRatio = pixelRatio;
      this.threeRenderer.setPixelRatio(pixelRatio);
    }

    this.threeRenderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const cameraZ = (height / 2) / Math.tan((45 * Math.PI) / 360);
    this.camera.position.set(0, 0, cameraZ);
    this.camera.updateProjectionMatrix();

    if (this.displayPlaneMesh) {
      this.displayPlaneMesh.geometry.dispose();
      this.displayPlaneMesh.geometry = new THREE.PlaneGeometry(width, height);
      this.displayPlaneMesh.position.set(0, 0, 0);
      this.displayPlaneMesh.rotation.set(0, 0, 0);
      this.displayPlaneMesh.renderOrder = 0;
    }

    const renderW = Math.max(1, Math.floor(this.width * this.pixelRatio));
    const renderH = Math.max(1, Math.floor(this.height * this.pixelRatio));

    this.composer.setSize(width, height);
    if (this.bloomPass) {
      this.bloomPass.setSize(Math.floor(width / 2), Math.floor(height / 2));
    }

    if (this.canvasKit && this.isReady) {
      // Cria um novo canvas limpo com as novas dimensões para garantir que a superfície do Skia
      // nunca sofra corrupção ou perda de contexto WebGL
      if (this.skSurface) {
        try {
          this.skSurface.delete();
        } catch {}
      }

      const newCanvas = document.createElement('canvas');
      newCanvas.width = renderW;
      newCanvas.height = renderH;
      this.skiaCanvasElement = newCanvas;

      const surface =
        this.canvasKit.MakeSWCanvasSurface(newCanvas) ||
        this.canvasKit.MakeWebGLCanvasSurface(newCanvas, this.canvasKit.ColorSpace.SRGB);

      if (surface) {
        this.skSurface = surface;
        this.skCanvas = this.skSurface.getCanvas();
      }

      // Re-instancia a textura do Three.js para alocar exatamente a nova resolução no WebGL
      if (this.skiaTexture) {
        this.skiaTexture.dispose();
      }
      this.skiaTexture = new THREE.CanvasTexture(this.skiaCanvasElement);
      this.skiaTexture.minFilter = THREE.LinearFilter;
      this.skiaTexture.magFilter = THREE.LinearFilter;
      this.skiaTexture.generateMipmaps = false;

      (this.displayPlaneMesh.material as THREE.MeshBasicMaterial).map = this.skiaTexture;
      (this.displayPlaneMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  public flush(): void {
    const gl = this.threeRenderer.getContext();
    if (gl) {
      gl.flush();
    }
  }

  public getCanvasKit(): CanvasKit {
    return this.canvasKit;
  }
}
