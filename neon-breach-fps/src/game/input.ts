import type { InputSnapshot } from "./types";

const POINTER_LOCK_WARMUP_MS = 120;
const MAX_MOUSE_EVENT_DELTA = 140;
const MAX_MOUSE_FRAME_DELTA = 220;
const DROP_MOUSE_EVENT_DELTA = 900;
const TOUCH_LOOK_SCALE = 1.25;

type TouchAction = "fire" | "reload" | "jump" | "sprint" | "crouch";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export class InputController {
  private keys = new Set<string>();
  private firePressed = false;
  private fireHeld = false;
  private reloadPressed = false;
  private jumpPressed = false;
  private crouchHeld = false;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private ignoreMouseUntil = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchFireHeld = false;
  private touchSprintHeld = false;
  private touchCrouchHeld = false;
  private touchJoystickPointerId: number | undefined;
  private touchLookPointerId: number | undefined;
  private touchLookLastX = 0;
  private touchLookLastY = 0;
  private readonly activeTouchPointers = new Map<number, TouchAction>();
  private readonly touchButtons: HTMLElement[] = [];
  private readonly touchJoystick = document.querySelector<HTMLElement>("#touchJoystick");

  constructor(private readonly lockTarget: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.lockTarget.addEventListener("pointerdown", this.onTouchLookDown);
    this.lockTarget.addEventListener("pointermove", this.onTouchLookMove);
    this.lockTarget.addEventListener("pointerup", this.onTouchLookEnd);
    this.lockTarget.addEventListener("pointercancel", this.onTouchLookEnd);
    this.lockTarget.addEventListener("contextmenu", this.onContextMenu);
    this.bindTouchButtons();
    this.bindTouchJoystick();
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
    this.lockTarget.removeEventListener("pointerdown", this.onTouchLookDown);
    this.lockTarget.removeEventListener("pointermove", this.onTouchLookMove);
    this.lockTarget.removeEventListener("pointerup", this.onTouchLookEnd);
    this.lockTarget.removeEventListener("pointercancel", this.onTouchLookEnd);
    this.lockTarget.removeEventListener("contextmenu", this.onContextMenu);
    for (const button of this.touchButtons) {
      button.removeEventListener("pointerdown", this.onTouchButtonDown);
      button.removeEventListener("pointerup", this.onTouchButtonEnd);
      button.removeEventListener("pointercancel", this.onTouchButtonEnd);
      button.removeEventListener("lostpointercapture", this.onTouchButtonEnd);
      button.removeEventListener("contextmenu", this.onContextMenu);
    }
    this.touchJoystick?.removeEventListener("pointerdown", this.onTouchJoystickDown);
    this.touchJoystick?.removeEventListener("pointermove", this.onTouchJoystickMove);
    this.touchJoystick?.removeEventListener("pointerup", this.onTouchJoystickEnd);
    this.touchJoystick?.removeEventListener("pointercancel", this.onTouchJoystickEnd);
    this.touchJoystick?.removeEventListener("lostpointercapture", this.onTouchJoystickEnd);
    this.touchJoystick?.removeEventListener("contextmenu", this.onContextMenu);
  }

  requestPointerLock() {
    if (!this.canRequestPointerLock()) return Promise.resolve(false);
    this.resetMouseLookBuffer();
    try {
      const request = (this.lockTarget.requestPointerLock as (() => Promise<void> | void) | undefined)?.();
      if (request && typeof request.then === "function") {
        return request.then(() => this.isPointerLocked()).catch(() => false);
      }
      return new Promise<boolean>((resolve) => {
        window.setTimeout(() => resolve(this.isPointerLocked()), 80);
      });
    } catch {
      return Promise.resolve(false);
    }
  }

  isPointerLocked() {
    return document.pointerLockElement === this.lockTarget;
  }

  canRequestPointerLock() {
    return !this.usesTouchControls() && typeof this.lockTarget.requestPointerLock === "function";
  }

  usesTouchControls() {
    const coarsePrimaryPointer = window.matchMedia("(pointer: coarse)").matches;
    const finePointerAvailable = window.matchMedia("(any-pointer: fine)").matches;
    const hoverAvailable = window.matchMedia("(any-hover: hover)").matches;
    return coarsePrimaryPointer && !finePointerAvailable && !hoverAvailable;
  }

  consumeMouseDelta() {
    if (!this.isPointerLocked() && !this.usesTouchControls()) this.resetMouseLookBuffer();
    const delta = {
      x: clamp(this.mouseDeltaX, -MAX_MOUSE_FRAME_DELTA, MAX_MOUSE_FRAME_DELTA),
      y: clamp(this.mouseDeltaY, -MAX_MOUSE_FRAME_DELTA, MAX_MOUSE_FRAME_DELTA),
    };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  snapshot(): InputSnapshot {
    const keyboardX = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const keyboardY = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const moveX = clamp(keyboardX + this.touchMoveX, -1, 1);
    const moveY = clamp(keyboardY + this.touchMoveY, -1, 1);
    const snapshot: InputSnapshot = {
      moveX,
      moveY,
      forward: moveY > 0.05,
      backward: moveY < -0.05,
      left: moveX < -0.05,
      right: moveX > 0.05,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.touchSprintHeld,
      crouch: this.crouchHeld || this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.touchCrouchHeld,
      jumpPressed: this.jumpPressed,
      reloadPressed: this.reloadPressed,
      firePressed: (this.isPointerLocked() && (this.firePressed || this.fireHeld)) || this.touchFireHeld,
    };
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.firePressed = false;
    return snapshot;
  }

  private bindTouchButtons() {
    const buttons = [...document.querySelectorAll<HTMLElement>("[data-touch-action]")];
    for (const button of buttons) {
      this.touchButtons.push(button);
      button.addEventListener("pointerdown", this.onTouchButtonDown);
      button.addEventListener("pointerup", this.onTouchButtonEnd);
      button.addEventListener("pointercancel", this.onTouchButtonEnd);
      button.addEventListener("lostpointercapture", this.onTouchButtonEnd);
      button.addEventListener("contextmenu", this.onContextMenu);
    }
  }

  private bindTouchJoystick() {
    if (!this.touchJoystick) return;
    this.touchJoystick.addEventListener("pointerdown", this.onTouchJoystickDown);
    this.touchJoystick.addEventListener("pointermove", this.onTouchJoystickMove);
    this.touchJoystick.addEventListener("pointerup", this.onTouchJoystickEnd);
    this.touchJoystick.addEventListener("pointercancel", this.onTouchJoystickEnd);
    this.touchJoystick.addEventListener("lostpointercapture", this.onTouchJoystickEnd);
    this.touchJoystick.addEventListener("contextmenu", this.onContextMenu);
  }

  private readTouchAction(target: EventTarget | null): TouchAction | undefined {
    if (!(target instanceof HTMLElement)) return undefined;
    const action = target.dataset.touchAction;
    if (
      action === "fire" ||
      action === "reload" ||
      action === "jump" ||
      action === "sprint" ||
      action === "crouch"
    ) {
      return action;
    }
    return undefined;
  }

  private recomputeTouchHeld() {
    const active = new Set(this.activeTouchPointers.values());
    this.touchFireHeld = active.has("fire");
    this.touchSprintHeld = active.has("sprint");
    this.touchCrouchHeld = active.has("crouch");
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyR"].includes(
        event.code,
      )
    ) {
      event.preventDefault();
    }
    if (!event.repeat && event.code === "Space") this.jumpPressed = true;
    if (!event.repeat && event.code === "KeyR") this.reloadPressed = true;
    if (event.ctrlKey || event.code === "ControlLeft" || event.code === "ControlRight") this.crouchHeld = true;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === "ControlLeft" || event.code === "ControlRight" || !event.ctrlKey) {
      this.crouchHeld = event.ctrlKey;
    }
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

  private onTouchButtonDown = (event: PointerEvent) => {
    const action = this.readTouchAction(event.currentTarget);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture?.(event.pointerId);

    this.activeTouchPointers.set(event.pointerId, action);
    if (action === "jump") this.jumpPressed = true;
    if (action === "reload") this.reloadPressed = true;
    this.recomputeTouchHeld();
  };

  private onTouchButtonEnd = (event: PointerEvent) => {
    const action = this.readTouchAction(event.currentTarget);
    if (!action && !this.activeTouchPointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    this.activeTouchPointers.delete(event.pointerId);
    this.recomputeTouchHeld();
  };

  private onTouchJoystickDown = (event: PointerEvent) => {
    if (!this.touchJoystick || this.touchJoystickPointerId !== undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.touchJoystickPointerId = event.pointerId;
    this.touchJoystick.setPointerCapture?.(event.pointerId);
    this.updateTouchJoystick(event.clientX, event.clientY);
  };

  private onTouchJoystickMove = (event: PointerEvent) => {
    if (event.pointerId !== this.touchJoystickPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.updateTouchJoystick(event.clientX, event.clientY);
  };

  private onTouchJoystickEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.touchJoystickPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.resetTouchJoystick();
  };

  private updateTouchJoystick(clientX: number, clientY: number) {
    if (!this.touchJoystick) return;
    const bounds = this.touchJoystick.getBoundingClientRect();
    const knob = this.touchJoystick.querySelector<HTMLElement>(".touch-joystick-knob");
    const knobSize = knob?.getBoundingClientRect().width ?? 58;
    const maxRadius = Math.max(1, (Math.min(bounds.width, bounds.height) - knobSize) / 2);
    const rawX = clientX - (bounds.left + bounds.width / 2);
    const rawY = clientY - (bounds.top + bounds.height / 2);
    const distance = Math.hypot(rawX, rawY);
    const limit = distance > maxRadius ? maxRadius / distance : 1;
    const x = rawX * limit;
    const y = rawY * limit;
    const normalizedX = x / maxRadius;
    const normalizedY = -y / maxRadius;
    const deadZone = 0.08;

    this.touchMoveX = Math.abs(normalizedX) < deadZone ? 0 : normalizedX;
    this.touchMoveY = Math.abs(normalizedY) < deadZone ? 0 : normalizedY;
    this.touchJoystick.style.setProperty("--joystick-x", `${x}px`);
    this.touchJoystick.style.setProperty("--joystick-y", `${y}px`);
    this.touchJoystick.dataset.axisX = this.touchMoveX.toFixed(3);
    this.touchJoystick.dataset.axisY = this.touchMoveY.toFixed(3);
    this.touchJoystick.classList.add("is-active");
  }

  private resetTouchJoystick() {
    this.touchJoystickPointerId = undefined;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    if (!this.touchJoystick) return;
    this.touchJoystick.style.setProperty("--joystick-x", "0px");
    this.touchJoystick.style.setProperty("--joystick-y", "0px");
    this.touchJoystick.dataset.axisX = "0.000";
    this.touchJoystick.dataset.axisY = "0.000";
    this.touchJoystick.classList.remove("is-active");
  }

  private onTouchLookDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" || this.touchLookPointerId !== undefined) return;
    if (event.clientX < window.innerWidth * 0.34) return;
    event.preventDefault();
    this.touchLookPointerId = event.pointerId;
    this.touchLookLastX = event.clientX;
    this.touchLookLastY = event.clientY;
    this.lockTarget.setPointerCapture?.(event.pointerId);
  };

  private onTouchLookMove = (event: PointerEvent) => {
    if (event.pointerId !== this.touchLookPointerId) return;
    event.preventDefault();
    const dx = (event.clientX - this.touchLookLastX) * TOUCH_LOOK_SCALE;
    const dy = (event.clientY - this.touchLookLastY) * TOUCH_LOOK_SCALE;
    this.touchLookLastX = event.clientX;
    this.touchLookLastY = event.clientY;
    this.mouseDeltaX += clamp(dx, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA);
    this.mouseDeltaY += clamp(dy, -MAX_MOUSE_EVENT_DELTA, MAX_MOUSE_EVENT_DELTA);
  };

  private onTouchLookEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.touchLookPointerId) return;
    event.preventDefault();
    this.touchLookPointerId = undefined;
  };

  private onContextMenu = (event: Event) => {
    event.preventDefault();
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
    this.activeTouchPointers.clear();
    this.recomputeTouchHeld();
    this.resetTouchJoystick();
    this.touchLookPointerId = undefined;
    this.jumpPressed = false;
    this.reloadPressed = false;
    this.crouchHeld = false;
    this.resetMouseLookBuffer();
  }

  private resetMouseLookBuffer() {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.ignoreMouseUntil = performance.now() + POINTER_LOCK_WARMUP_MS;
  };
}
