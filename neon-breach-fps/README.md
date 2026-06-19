# Neon Breach FPS

Codex workspace for the 3D FPS prototype built with Vite, TypeScript, and Three.js.

GitHub repository: https://github.com/JxxK666/Games

The GitHub repository stores this game under:

```text
neon-breach-fps/
```

This Codex workspace stores the same game at the workspace root.

## Run Locally

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Current Version

Current local iteration: `0.2.0`

See `CHANGELOG.md` for release notes.

## Visual QA

```bash
npm run qa:visual
```

Screenshots are written to `outputs/`.

## Main Files

```text
src/main.ts                 app entry and game loop
src/game/simulation.ts      player, shooting, AI, damage, level flow
src/game/level.ts           procedural indoor public-area levels
src/render/gameRenderer.ts  Three.js scene, lighting, effects, low-poly props
src/render/audio.ts         generated weapon and combat audio
src/ui/hud.ts               HUD, menu, death and transition screens
src/styles.css              overlay and HUD styling
```

## GitHub Pages

The repository contains a GitHub Actions workflow at:

```text
.github/workflows/pages.yml
```

It builds the `neon-breach-fps/` folder and deploys `dist/` to GitHub Pages.
