# 🌊 Pulse Wave

**Pulse Wave** é um motor e estúdio de visualização musical áudio-reativa 3D em tempo real e offline, inspirado na arquitetura moderna do Vizzy.io. Desenvolvido com **TypeScript**, **Three.js**, **CanvasKit (Google Skia WASM)**, **WebCodecs** e um inicializador desktop em **.NET 10 / WebView2**.

---

## ✨ Recursos

- 🎵 **Motor DSP em Tempo Real & Offline**:
  - Transformada Rápida de Fourier (Cooley-Tukey Radix-2 FFT).
  - Janelamento Hann e Transformada Constant-Q (CQT) em 120 bandas logarítmicas (25 Hz a 16 kHz).
  - Compensação psicoacústica (+4 dB/oitava) e smoothing temporal assimétrico (Attack 0.65 / Decay 0.18).
  - Detetor de transientes e sub-graves (*bass kick ratio*).
  - Web Worker dedicado com transferência de memória *Zero-Copy*.

- 🎨 **Renderização Híbrida 2D + 3D (FBO Bridge)**:
  - **CanvasKit (Skia WASM)**: Desenho vetorial de anéis de frequência polares, barras espectrais com cantos arredondados, osciloscópio de forma de onda e tipografia antialiased de alta resolução.
  - **Three.js**: Composição em espaço 3D, malhas planas de textura e sistema de partículas volumétrico.
  - **Pós-Processamento GPU**: UnrealBloomPass com amostragem eficiente, aberração cromática dinâmica reativa aos graves e granulação cinematográfica com vinheta.

- 💫 **Motor de Partículas 3D com 3 Estilos de Movimento**:
  - **Starfield 3D**: Projeção em perspectiva com viagem em direção à tela (*Warp Speed*).
  - **Neve (Snow Fall)**: Queda vertical suave com gravidade diferenciada, vento harmónico e rajadas no bumbo.
  - **Orbital**: Constelação tridimensional em disco com expansão radial.
  - Controle de reatividade ao áudio (*toggle* e regulador de sensibilidade do bumbo).

- 🎬 **Exportação Determinística de Vídeo (WebCodecs)**:
  - Renderização frame a frame precisa ($\Delta t = 1/\text{fps}$) sem depender do relógio do sistema ou perda de quadros.
  - Codificação acelerada por hardware (H.264 / AVC) ou por processador (VP9 seguro) em contentor **MP4** ou **WebM**.
  - Pipelining assíncrono paralelo e perfis de velocidade (Turbo 720p @ 30 FPS, Equilibrado 1080p @ 30 FPS, Ultra 1080p @ 60 FPS).

- 🖥️ **Aplicativo Desktop Windows**:
  - Inicialização ultrarrápida em `.NET 10` usando o runtime Evergreen do WebView2 com flags de aceleração GPU ativadas.
  - Janela escura nativa integrada ao Windows DWM.

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+)
- [.NET 10 SDK](https://dotnet.microsoft.com/) *(opcional, apenas para compilar o executável Windows)*

### Modo Web / Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar servidor local
npm run dev
```

### Compilar para Produção (Web)
```bash
npm run build
```

### Compilar o Executável Desktop (.exe)
```bash
npm run build:app
```
O executável gerado estará localizado em `app/PulseWave.exe`.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagens**: TypeScript, C#, GLSL, HTML5, CSS3
- **Gráficos & Renderização**: Three.js, CanvasKit-WASM (Skia)
- **Áudio & DSP**: Web Audio API, Web Workers
- **Exportação de Mídia**: WebCodecs API, `mp4-muxer`, `webm-muxer`
- **Build & Ferramentas**: Vite, .NET 10 SDK, Windows Forms / WebView2

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
