export interface PresetDefinition {
  name: string;
  description: string;
  layers: Record<string, Record<string, any>>;
  renderer: {
    bloomStrength: number;
    bloomRadius: number;
    bloomThreshold: number;
    chromaticAberration: boolean;
    particles: boolean;
  };
}

export const PRESETS: Record<string, PresetDefinition> = {
  cyberpunk: {
    name: 'Cyberpunk Neon',
    description: 'Estética futurista com anel ciano/magenta, partículas 3D e aberração cromática.',
    layers: {
      'background-layer': {
        enabled: true,
        style: 'grid',
        colorA: [20, 35, 75],
        colorB: [4, 6, 14],
        gridSize: 75,
        pulseReactivity: 1.2,
      },
      'spectrum-ring-layer': {
        enabled: true,
        primaryColor: [0, 220, 255],
        kickColor: [255, 40, 180],
        strokeWidth: 5,
        kickExpansion: 42,
        deformationScale: 95,
        shockwaveEnabled: true,
      },
      'spectrum-bars-layer': {
        enabled: true,
        barCount: 48,
        maxHeight: 110,
        colorLow: [0, 210, 255],
        colorHigh: [255, 50, 170],
      },
      'waveform-layer': {
        enabled: false,
      },
      'image-logo-layer': {
        enabled: true,
        radius: 80,
        borderColor: [0, 220, 255],
      },
      'text-typography-layer': {
        enabled: true,
        title: 'NEON CYBERPUNK',
        subtitle: 'CQT DSP MODULAR ENGINE',
        colorTitle: [255, 255, 255],
        colorSubtitle: [0, 225, 255],
      },
    },
    renderer: {
      bloomStrength: 0.85,
      bloomRadius: 0.35,
      bloomThreshold: 0.82,
      chromaticAberration: true,
      particles: true,
    },
  },

  synthwave: {
    name: 'Sunset Synthwave',
    description: 'Tons quentes de pôr do sol dos anos 80, gradiente suave e osciloscópio activo.',
    layers: {
      'background-layer': {
        enabled: true,
        style: 'gradient',
        colorA: [80, 20, 90],
        colorB: [15, 6, 30],
        pulseReactivity: 0.8,
      },
      'spectrum-ring-layer': {
        enabled: true,
        primaryColor: [255, 140, 0],
        kickColor: [255, 40, 120],
        strokeWidth: 6,
        kickExpansion: 35,
        deformationScale: 80,
        shockwaveEnabled: true,
      },
      'spectrum-bars-layer': {
        enabled: true,
        barCount: 36,
        maxHeight: 90,
        colorLow: [255, 120, 0],
        colorHigh: [255, 0, 128],
      },
      'waveform-layer': {
        enabled: true,
        strokeWidth: 3,
        color: [255, 200, 40],
        amplitude: 50,
        positionYOffset: -35,
      },
      'image-logo-layer': {
        enabled: true,
        radius: 75,
        borderColor: [255, 140, 0],
      },
      'text-typography-layer': {
        enabled: true,
        title: 'RETRO SYNTHWAVE',
        subtitle: 'OUTRUN 1984 VIBES',
        colorTitle: [255, 230, 200],
        colorSubtitle: [255, 130, 40],
      },
    },
    renderer: {
      bloomStrength: 0.8,
      bloomRadius: 0.35,
      bloomThreshold: 0.8,
      chromaticAberration: true,
      particles: true,
    },
  },

  minimalist: {
    name: 'Dark Minimalist',
    description: 'Estética monocromática de alto contraste com foco em precisão e elegância.',
    layers: {
      'background-layer': {
        enabled: true,
        style: 'starfield',
        colorA: [10, 10, 15],
        colorB: [2, 2, 4],
        pulseReactivity: 0.5,
      },
      'spectrum-ring-layer': {
        enabled: true,
        primaryColor: [240, 240, 255],
        kickColor: [160, 200, 255],
        strokeWidth: 3,
        kickExpansion: 25,
        deformationScale: 110,
        shockwaveEnabled: false,
      },
      'spectrum-bars-layer': {
        enabled: false,
      },
      'waveform-layer': {
        enabled: true,
        strokeWidth: 2,
        color: [255, 255, 255],
        amplitude: 70,
        positionYOffset: -35,
      },
      'image-logo-layer': {
        enabled: true,
        radius: 85,
        borderColor: [255, 255, 255],
        borderWidth: 2,
      },
      'text-typography-layer': {
        enabled: true,
        title: 'MINIMAL MONOCHROME',
        subtitle: 'PRECISION DSP SPECTROGRAM',
        colorTitle: [255, 255, 255],
        colorSubtitle: [180, 190, 210],
      },
    },
    renderer: {
      bloomStrength: 0.9,
      bloomRadius: 0.3,
      bloomThreshold: 0.3,
      chromaticAberration: false,
      particles: false,
    },
  },

  astral: {
    name: 'Astral EDM',
    description: 'Campo estelar com pulso galáctico e ondas ultra-sensíveis.',
    layers: {
      'background-layer': {
        enabled: true,
        style: 'starfield',
        pulseReactivity: 1.6,
      },
      'spectrum-ring-layer': {
        enabled: true,
        primaryColor: [120, 80, 255],
        kickColor: [0, 255, 200],
        strokeWidth: 6,
        kickExpansion: 50,
        deformationScale: 120,
        shockwaveEnabled: true,
      },
      'spectrum-bars-layer': {
        enabled: true,
        barCount: 56,
        maxHeight: 120,
        colorLow: [100, 70, 255],
        colorHigh: [0, 255, 200],
      },
      'waveform-layer': {
        enabled: false,
      },
      'image-logo-layer': {
        enabled: true,
        radius: 80,
        borderColor: [0, 255, 200],
      },
      'text-typography-layer': {
        enabled: true,
        title: 'ASTRAL FREQUENCIES',
        subtitle: 'ELECTRONIC DANCE REACTION',
        colorTitle: [255, 255, 255],
        colorSubtitle: [150, 100, 255],
      },
    },
    renderer: {
      bloomStrength: 0.9,
      bloomRadius: 0.35,
      bloomThreshold: 0.8,
      chromaticAberration: true,
      particles: true,
    },
  },
};
