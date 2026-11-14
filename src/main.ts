import { FboHybridRenderer } from './render/FboHybridRenderer';
import { AudioEngine } from './dsp/AudioEngine';
import { DeterministicTimeline } from './export/DeterministicTimeline';
import { ExportModalUi } from './ui/ExportModalUi';
import { Composition } from './engine/Composition';
import { VizzyStudioUi } from './ui/VizzyStudioUi';
import type { CanvasKit, Canvas } from 'canvaskit-wasm';

async function bootstrap() {
  const container = document.getElementById('app') || document.body;
  container.innerHTML = '';
  container.style.margin = '0';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = '#0a0c12';

  // Canvas WebGL renderizado dentro do monitor central
  const canvas = document.createElement('canvas');

  // 1. Inicializa a Composição e Motor DSP de Áudio
  const composition = new Composition();
  const audioEngine = new AudioEngine();

  // 2. Inicializa o Renderizador Híbrido GPU (Skia + Three.js + Bloom)
  const initialWidth = 960;
  const initialHeight = 540;
  const hybrid = new FboHybridRenderer({
    canvas,
    width: initialWidth,
    height: initialHeight,
  });

  await hybrid.init();
  console.log('FboHybridRenderer: Skia e Three.js inicializados.');

  // Aplica o preset Cyberpunk Neon como base
  composition.applyPreset('cyberpunk', hybrid);

  // 3. Constrói a Interface 1:1 do Studio Vizzy.io (Header, Activity Bar, Monitor, Inspector, DAW Timeline)
  const studioUi = new VizzyStudioUi(container, composition, hybrid, audioEngine, canvas);

  // Ajusta a resolução inicial do monitor
  const monitorEl = studioUi.getViewportElement();
  setTimeout(() => {
    const w = monitorEl.clientWidth || 960;
    const h = monitorEl.clientHeight || 540;
    hybrid.setSize(w, h);
    studioUi.drawAudioWaveform();
  }, 50);

  // 4. Instancia a Timeline Determinística de Exportação WebCodecs
  const deterministicTimeline = new DeterministicTimeline(hybrid, canvas);
  let isExporting = false;

  // 5. Configura o Diálogo Modal de Exportação MP4
  const exportModal = new ExportModalUi({
    onStartExport: async (config) => {
      let buffer = audioEngine.getAudioBuffer();
      if (!buffer) {
        // Se nenhuma música estiver carregada, sintetiza a demo proceduralmente
        await audioEngine.generateDemoTrack();
        buffer = audioEngine.getAudioBuffer();
        studioUi.drawAudioWaveform();
      }

      if (!buffer) {
        alert('Nenhuma faixa de áudio pronta para exportação.');
        exportModal.hide();
        return;
      }

      // Pausa o áudio em tempo real durante a codificação offline
      audioEngine.pause();
      isExporting = true;

      try {
        const sampleRate = audioEngine.getSampleRate();
        const trackName = audioEngine.getTrackName().replace(/[^a-zA-Z0-9_-]/g, '_');

        // Renderização determinística offline frame a frame com WebCodecs
        const exportResult = await deterministicTimeline.exportVideo(
          buffer,
          sampleRate,
          {
            width: config.width,
            height: config.height,
            fps: config.fps,
            bitrate: 10_000_000,
            format: config.format,
          },
          drawVisualizerScene,
          (progress, currentFrame, totalFrames, estimatedSecs) => {
            exportModal.updateProgress(progress, currentFrame, totalFrames, estimatedSecs);
          }
        );

        // Download automático do ficheiro de vídeo gerado (.mp4 ou .webm)
        const downloadUrl = URL.createObjectURL(exportResult.blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${trackName}_${config.width}x${config.height}.${exportResult.extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        exportModal.hide();
      } catch (err: any) {
        if (err.message !== 'Exportação cancelada pelo utilizador.') {
          console.error('Falha na exportação de vídeo:', err);
          alert(`Erro na exportação de vídeo:\n${err.message || err}`);
        }
      } finally {
        isExporting = false;
        const w = monitorEl.clientWidth || 960;
        const h = monitorEl.clientHeight || 540;
        hybrid.setSize(w, h);
      }
    },
    onCancelExport: () => {
      deterministicTimeline.cancel();
      isExporting = false;
      const w = monitorEl.clientWidth || 960;
      const h = monitorEl.clientHeight || 540;
      hybrid.setSize(w, h);
    },
  });

  studioUi.onExportRequested = () => {
    exportModal.show();
  };

  // Redimensionamento responsivo do monitor
  window.addEventListener('resize', () => {
    if (!isExporting) {
      const w = monitorEl.clientWidth || 960;
      const h = monitorEl.clientHeight || 540;
      hybrid.setSize(w, h);
      studioUi.drawAudioWaveform();
    }
  });

  /**
   * Função central de renderização que alimenta a hierarquia de camadas da Composição.
   * Partilhada entre a pré-visualização interactiva a 60 FPS e a exportação determinística MP4.
   */
  function drawVisualizerScene(
    CanvasKit: CanvasKit,
    skCanvas: Canvas,
    renderW: number,
    renderH: number,
    time: number,
    spectrum: Float32Array,
    bassImpact: number,
    cumulative: number,
    timeDomain?: Float32Array
  ) {
    composition.render({
      ck: CanvasKit,
      canvas: skCanvas,
      width: renderW,
      height: renderH,
      time,
      spectrum,
      bassImpact,
      cumulative,
      timeDomain,
    });
  }

  const startTime = performance.now();

  // =========================================================================
  // LOOP DE RENDERIZAÇÃO AUDIO-REATIVO A 60 FPS (Preview Interativo)
  // =========================================================================
  function loop(now: number) {
    if (!isExporting) {
      const elapsed = (now - startTime) * 0.001;

      // 1. Atualiza e envia amostras PCM para o Worker DSP
      audioEngine.update();

      // 2. Extrai telemetria de sinal mais recente
      const spectrum = audioEngine.getSpectrum();
      const bassImpact = audioEngine.getBassImpact();
      const cumulative = audioEngine.getCumulativeAudio();
      const timeDomain = audioEngine.getTimeDomain();

      // 3. Renderiza Skia (2D) e Three.js (3D + Pós-processamento)
      hybrid.renderFrame(
        (CanvasKit, skCanvas, renderW, renderH, time) => {
          drawVisualizerScene(
            CanvasKit,
            skCanvas,
            renderW,
            renderH,
            time,
            spectrum,
            bassImpact,
            cumulative,
            timeDomain
          );
        },
        elapsed,
        bassImpact,
        spectrum
      );
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

bootstrap().catch((err) => {
  console.error('Falha no bootstrap:', err);
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '20px';
  errDiv.style.left = '20px';
  errDiv.style.right = '20px';
  errDiv.style.color = '#ff6b6b';
  errDiv.style.background = 'rgba(20, 5, 5, 0.95)';
  errDiv.style.padding = '18px';
  errDiv.style.border = '2px solid #ff4444';
  errDiv.style.borderRadius = '8px';
  errDiv.style.fontFamily = 'monospace';
  errDiv.style.fontSize = '14px';
  errDiv.style.whiteSpace = 'pre-wrap';
  errDiv.style.zIndex = '99999';
  errDiv.innerText = `Erro na Inicialização da Pipeline:\n${err?.stack || err?.message || err}`;
  document.body.appendChild(errDiv);
});
