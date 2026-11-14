/**
 * Shaders GLSL de pós-processamento personalizados para o Three.js EffectComposer.
 */

export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.003 },
    uBassImpact: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uBassImpact;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      if (dist < 0.0001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 ndir = dir / dist;
      float shift = (uAmount + uBassImpact * 0.005) * dist;

      vec2 uvR = clamp(vUv + ndir * shift, 0.0, 1.0);
      vec2 uvB = clamp(vUv - ndir * shift, 0.0, 1.0);

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, uvB).b;
      float a = texture2D(tDiffuse, vUv).a;

      gl_FragColor = vec4(r, g, b, a);
    }
  `,
};

export const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteDarkness: { value: 1.2 },
    uVignetteOffset: { value: 0.8 },
    uGrainIntensity: { value: 0.04 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    uniform float uGrainIntensity;
    uniform float uTime;
    varying vec2 vUv;

    // Gerador de ruído pseudo-aleatório
    float random(vec2 p) {
      return fract(sin(dot(p.xy + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Vinheta cinematográfica suave
      vec2 uv = (vUv - vec2(0.5)) * vec2(uVignetteOffset);
      float vignette = clamp(pow(cos(length(uv) * 3.14159 * 0.5), uVignetteDarkness), 0.0, 1.0);
      color.rgb *= vignette;

      // Granulação fílmica orgânica (Film Grain)
      float grain = (random(vUv) - 0.5) * uGrainIntensity;
      color.rgb += grain;

      gl_FragColor = color;
    }
  `,
};
