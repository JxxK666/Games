import type { InputSnapshot } from "./types";

const POINTER_LOCK_WARMUP_MS = 120;
const MAX_MOUSE_EVENT_DELTA = 140;
const MAX_MOUSE_FRAME_DELTA = 220;
const DROP_MOUSE_EVENT_DELTA = 900;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class InputController {
  private keys = new Set<string>();
  private firePressed = false;
  private fireHeld = false;
  private reloadPressed = false;
  private jumpPressed = false;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private ignoreMouseUntil = 0;

  constructor(private readonly lockTarget: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  requestPointerLock() {
    this.resetMouseLookBuffer();
    this.lockTarget.requestPointerLock();
  }

  isPointerLocked() {
    return document.pointerLockElement === this.lockTarget;
  }

  consumeMouseDelta() {
    if (!this.isPointerLocked()) this.resetMouseLookBuffer();
    const delta = {
      x: clamp(this.mouseDeltaX, -MAX_MOUSE_FRAME_DELTA, MAX_MOUSE_FRAME_DELTA),
      y: clamp(this.mouseDeltaY, -MAX_MOUSE_FRAME_DELTA, MAX_MOUSE_FRAME_DELTA),
    };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  snapshot(): InputSnapshot {
    const snapshot: InputSnapshot = {
      forward: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      backward: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      jumpPressed: this.jumpPressed,
      reloadPressed: this.reloadPressed,
      firePressed: this.isPointerLocked() && (this.firePressed || this.fireHeld),
    };
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.firePressed = false;
    return snapshot;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "KeyR"].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat && event.code === "Space") this.jumpPressed = true;
    if (!event.repeat && event.code === "KeyR") this.reloadPressed = true;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || !this.isPointerLocked()) return;
    this.firePressed = true;
    this.fireHeld = true;
  };

  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.fireHeld = false;
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.isPointerLocked()) return;
    if (performance.now() < this.ignoreMouseUntil) {
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
      return;
    }

    const dx = Number.isFinite(event.movementX) ? event.movementX : 0;
    const dy = Number.isFinite(event.movementY) ? event.movementY : 0;
    if (Math.abs(dx) > DROP_MOUSE_EVENT_DELTA || Math.abs(dy) > DROP_MOUSE_EVENT_DELTA) return;

    this.mouseDeltaX += clamp(dx, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA);
    this.mouseDeltaY += clamp(dy, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA);
  };

  private onPointerLockChange = () => {
    this.resetMouseLookBuffer();
    if (!this.isPointerLocked()) {
      this.firePressed = false;
      this.fireHeld = false;
    }
  };

  private onVisibilityChange = () => {
    if (document.visibilityState !== "visible") this.clearTransientInput();
  };

  private onWindowBlur = () => {
    this.clearTransientInput();
  };

  private clearTransientInput() {
    this.keys.clear();
    this.firePressed = false;
    this.fireHeld = false;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.resetMouseLookBuffer();
  }

  private resetMouseLookBuffer() {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.ignoreMouseUntil = performance.now() + POINTER_LOCK_WARMUP_MS;
  };
}
