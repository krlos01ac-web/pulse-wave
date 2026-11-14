import type { CanvasKit, Canvas } from 'canvaskit-wasm';

export interface LayerRenderContext {
  ck: CanvasKit;
  canvas: Canvas;
  width: number;
  height: number;
  time: number;
  spectrum: Float32Array;
  bassImpact: number;
  cumulative: number;
  timeDomain?: Float32Array;
}

export abstract class BaseLayer {
  public id: string;
  public name: string;
  public enabled: boolean = true;
  public opacity: number = 1.0;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  public abstract render(ctx: LayerRenderContext): void;

  public abstract getConfig(): Record<string, any>;
  public abstract setConfig(config: Record<string, any>): void;
}
