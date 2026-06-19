# Changelog

## 0.2.1 - Mouse Lock Reliability

- Fixed desktop mouse look not locking when the browser misses or rejects the first Pointer Lock request.
- Added an in-game mouse-lock prompt so players can click the scene again to capture the pointer.
- Moved mission start to the pointer-down gesture path so browser Pointer Lock permission is requested earlier.
- Updated visual QA mobile viewports to emulate touch input instead of narrow desktop windows.

## 0.2.0 - Mobile Landscape Controls

- Added landscape touch controls for mobile play.
- Added left-side movement buttons and right-side fire, jump, sprint, and reload buttons.
- Added touch drag camera look on the right side of the screen.
- Avoided pointer-lock requirements on touch devices.
- Added portrait orientation hint for mobile players.
- Added mobile-landscape visual QA coverage.
- Cleaned the page copy to stable ASCII text to avoid encoding corruption on deploy.

## 0.1.0 - First Playable Slice

- Built the browser FPS prototype with Vite, TypeScript, and Three.js.
- Added first-person movement, shooting, reload, jump, sprint, health, ammo, HUD, enemy AI, and procedural indoor public-area levels.
- Added level transitions, preloading, lighting, low-poly public-space props, and visual effects.
