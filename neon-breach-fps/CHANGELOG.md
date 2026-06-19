# Changelog

## 0.2.4 - Round-End Slow Motion and Crouch

- Added a 1.35-second slow-motion finish after the last enemy is defeated before the next-level loading screen appears.
- Kept enemy death movement, sparks, muzzle effects, and camera animation synchronized with the slow-motion time scale.
- Added hold-to-crouch controls on left or right Ctrl, including a smooth lower camera, lower firing origin, slower movement, and disabled sprinting and jumping while crouched.
- Added crouch controls to the start-screen reference and a distinct round-clear HUD treatment.

## 0.2.3 - Red Kill Confirm

- Kept regular hitmarkers white and changed kill-confirm hitmarkers to a strong red glow.
- Added a short, low staccato sound for regular hits.
- Added a clear layered ding sound for kill confirmations.
- Kept the thin four-stroke hitmarker shape from the previous iteration.

## 0.2.2 - Hit Confirm Feedback

- Replaced the old boxy hitmarker with a thin four-stroke X marker inspired by modern CS-style visual configs.
- Added a crisp synthetic bell/bubble hitsound for every enemy hit.
- Added a brighter layered kill-confirm sound and slightly longer kill hitmarker flash.
- Kept all hit feedback procedural, with no copied external audio assets.

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
