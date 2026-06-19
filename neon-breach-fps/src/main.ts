import "./styles.css";
import { GameSimulation } from "./game/simulation";
import { InputController } from "./game/input";
import { GameRenderer } from "./render/gameRenderer";
import { AudioDirector } from "./render/audio";
import { Hud } from "./ui/hud";

const root = document.querySelector<HTMLElement>("#game-root");
if (!root) throw new Error("Missing #game-root element");

const simulation = new GameSimulation();
const renderer = new GameRenderer(root, simulation.state);
const input = new InputController(renderer.renderer.domElement);
const hud = new Hud();
const audio = new AudioDirector();

hud.setMode("menu", simulation.state);

const shouldRequestMouseLook = () =>
  simulation.state.mode === "playing" && input.canRequestPointerLock() && !input.isPointerLocked();

const showMouseLockHint = (message = "Click the scene to lock mouse look") => {
  simulation.state.message = message;
  simulation.state.messageTimer = 2.4;
};

const requestMouseLook = () => {
  if (!shouldRequestMouseLook()) return;
  void input.requestPointerLock().then((locked) => {
    if (!locked && shouldRequestMouseLook()) {
      showMouseLockHint("Mouse was not locked. Click the prompt or scene again");
    }
  });
};

const queueNextLevelPreload = () => {
  const prepared = simulation.getPreparedLevel();
  const preload = () => renderer.preloadLevel(prepared.levelIndex, prepared.level);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload, { timeout: 900 });
  } else {
    setTimeout(preload, 350);
  }
};

const beginRun = () => {
  simulation.reset();
  simulation.start();
  renderer.reset(simulation.state);
  hud.setMode("playing", simulation.state);
  queueNextLevelPreload();
  requestMouseLook();
  void audio.unlock();
};

hud.onPrimaryAction(beginRun);
hud.onMouseLockRequest(requestMouseLook);

if (new URLSearchParams(window.location.search).has("autostart")) {
  window.setTimeout(() => {
    simulation.reset();
    simulation.start();
    renderer.reset(simulation.state);
    hud.setMode("playing", simulation.state);
    queueNextLevelPreload();
  }, 80);
}

document.addEventListener("pointerlockchange", () => {
  if (shouldRequestMouseLook()) showMouseLockHint("Click the prompt or scene to resume mouse look");
});

document.addEventListener("pointerlockerror", () => {
  if (shouldRequestMouseLook()) showMouseLockHint("Browser blocked mouse lock. Click the scene again");
});

renderer.renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.pointerType === "touch") return;
  if (shouldRequestMouseLook()) {
    event.preventDefault();
    requestMouseLook();
  }
});

const loop = () => {
  const dt = renderer.nextDelta();
  const mouse = input.consumeMouseDelta();
  simulation.rotate(mouse.x, mouse.y);

  const snapshot = input.snapshot();
  let events = simulation.update(dt, snapshot);
  if (snapshot.firePressed) events = events.concat(simulation.tryFire());
  if (snapshot.reloadPressed) events = events.concat(simulation.tryReload());

  if (events.length > 0) {
    renderer.handleEvents(events);
    audio.handleEvents(events);
    for (const event of events) {
      if (event.type === "enemyHit") hud.flashHitMarker(event.killed);
      if (event.type === "levelAdvanced") {
        renderer.reset(simulation.state);
        queueNextLevelPreload();
      }
      if (event.type === "stateChanged") {
        if ((event.mode === "dead" || event.mode === "victory") && document.pointerLockElement) document.exitPointerLock();
        hud.setMode(event.mode, simulation.state);
      }
    }
  }

  hud.update(simulation.state);
  hud.setMouseLockPromptVisible(shouldRequestMouseLook());
  renderer.update(simulation.state, dt * simulation.state.timeScale);
  window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);
