import type { GameMode, GameState } from "../game/types";

export class Hud {
  private readonly hud = document.querySelector<HTMLElement>("#hud")!;
  private readonly overlay = document.querySelector<HTMLElement>("#screenOverlay")!;
  private readonly title = document.querySelector<HTMLElement>("#screenTitle")!;
  private readonly kicker = document.querySelector<HTMLElement>("#screenKicker")!;
  private readonly body = document.querySelector<HTMLElement>("#screenBody")!;
  private readonly action = document.querySelector<HTMLButtonElement>("#primaryAction")!;
  private readonly objectiveText = document.querySelector<HTMLElement>("#objectiveText")!;
  private readonly objectiveDetail = document.querySelector<HTMLElement>("#objectiveDetail")!;
  private readonly healthBar = document.querySelector<HTMLElement>("#healthBar")!;
  private readonly healthText = document.querySelector<HTMLElement>("#healthText")!;
  private readonly ammoText = document.querySelector<HTMLElement>("#ammoText")!;
  private readonly killText = document.querySelector<HTMLElement>("#killText")!;
  private readonly notice = document.querySelector<HTMLElement>("#combatNotice")!;
  private readonly mouseLockPrompt = document.querySelector<HTMLButtonElement>("#mouseLockPrompt")!;
  private readonly vignette = document.querySelector<HTMLElement>("#damageVignette")!;
  private readonly hitMarker = document.querySelector<HTMLElement>("#hitMarker")!;
  private readonly progress = document.querySelector<HTMLElement>("#transitionProgress")!;
  private readonly progressFill = document.querySelector<HTMLElement>("#transitionProgress span")!;
  private readonly controls = document.querySelector<HTMLElement>(".control-grid")!;

  onPrimaryAction(callback: () => void) {
    this.action.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      callback();
    });
    this.action.addEventListener("keydown", (event) => {
      if (event.code !== "Enter" && event.code !== "Space") return;
      event.preventDefault();
      callback();
    });
  }

  onMouseLockRequest(callback: () => void) {
    this.mouseLockPrompt.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      callback();
    });
  }

  setMouseLockPromptVisible(visible: boolean) {
    this.mouseLockPrompt.classList.toggle("is-visible", visible);
  }

  setMode(mode: GameMode, state: GameState) {
    this.hud.classList.toggle("is-hidden", mode !== "playing");
    this.overlay.classList.toggle("is-hidden", mode === "playing");
    this.overlay.classList.remove("is-dead", "is-victory");
    this.progress.classList.toggle("is-visible", mode === "transition");
    this.action.classList.toggle("is-hidden", mode === "transition");
    this.controls.classList.toggle("is-hidden", mode === "transition");

    if (mode === "menu") {
      this.kicker.textContent = "NEON BREACH";
      this.title.textContent = state.level.theme.name;
      this.body.textContent =
        "A brighter indoor public-space slice. Each run randomizes the location, cover props, signs, and enemy positions in front of the player.";
      this.action.textContent = "Start Mission";
    }

    if (mode === "transition") {
      this.kicker.textContent = `LEVEL ${state.levelIndex}`;
      this.title.textContent = state.level.theme.name;
      this.body.textContent = `Loading a new ${state.level.layoutName} layout with fresh cover and enemy positions.`;
      this.progressFill.style.width = `${Math.max(5, state.transitionProgress * 100)}%`;
    }

    if (mode === "dead") {
      this.overlay.classList.add("is-dead");
      this.kicker.textContent = "MISSION FAILED";
      this.title.textContent = "Armor Offline";
      this.body.textContent = `You cleared ${state.player.kills}/${state.totalEnemies} guards in ${state.level.theme.name}. Use benches, counters, and signs as cover, then redeploy.`;
      this.action.textContent = "Redeploy";
    }

    if (mode === "victory") {
      this.overlay.classList.add("is-victory");
      this.kicker.textContent = "MISSION CLEAR";
      this.title.textContent = "Area Secured";
      this.body.textContent = `${state.level.theme.name} is clear. All ${state.totalEnemies} randomized guards were defeated.`;
      this.action.textContent = "Play Again";
    }
  }

  update(state: GameState) {
    const player = state.player;
    const defeated = state.enemies.filter((enemy) => enemy.state === "dead").length;
    const healthRatio = Math.max(0, player.health / player.maxHealth);
    this.objectiveText.textContent = `L${state.levelIndex} ${state.level.theme.objectiveLabel}`;
    this.objectiveDetail.textContent = `${state.level.theme.name} | ${state.level.layoutName} | enemies ${defeated} / ${state.totalEnemies}`;
    if (state.mode === "transition") this.progressFill.style.width = `${Math.max(5, state.transitionProgress * 100)}%`;
    this.healthBar.style.width = `${healthRatio * 100}%`;
    this.healthText.textContent = `${Math.ceil(player.health)}`;
    this.ammoText.textContent = player.reloadTimer > 0 ? "Reloading" : `${player.ammo} / ${player.reserveAmmo}`;
    this.killText.textContent = `${player.kills}`;
    this.notice.textContent = state.messageTimer > 0 ? state.message : "";
    this.notice.classList.toggle("is-visible", state.messageTimer > 0);
    this.vignette.style.opacity = `${Math.min(0.82, player.hurtTimer * 1.25)}`;
  }

  flashHitMarker(killed: boolean) {
    this.hitMarker.classList.remove("is-visible", "is-kill");
    window.requestAnimationFrame(() => {
      this.hitMarker.classList.add("is-visible");
      this.hitMarker.classList.toggle("is-kill", killed);
    });
    window.setTimeout(() => this.hitMarker.classList.remove("is-visible", "is-kill"), 120);
  }
}
