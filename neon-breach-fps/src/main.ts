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

const queueNextLevelPreload = () => {
  const prepared = simulation.getPreparedLevel();
  const preload = () => renderer.preloadLevel(prepared.levelIndex, prepared.level);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload, { timeout: 900 });
  } else {
    setTimeout(preload, 350);
  }
};

const beginRun = async () => {
  simulation.reset();
  simulation.start();
  renderer.reset(simulation.state);
  hud.setMode("playing", simulation.state);
  queueNextLevelPreload();
  input.requestPointerLock();
  await audio.unlock();
};

hud.onPrimaryAction(beginRun);

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
  if (simulation.state.mode === "playing" && !input.usesTouchControls() && !input.isPointerLocked()) {
    simulation.state.message = "Click the scene to resume mouse look";
    simulation.state.messageTimer = 1.5;
  }
});

renderer.renderer.domElement.addEventListener("click", () => {
  if (simulation.state.mode === "playing" && !input.usesTouchControls() && !input.isPointerLocked()) {
    input.requestPointerLock();
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
  renderer.update(simulation.state, dt);
  window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);
