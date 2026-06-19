import { createLevel } from "./level";
import type {
  EnemyStateData,
  GameEvent,
  GameMode,
  GameState,
  InputSnapshot,
  LevelData,
  RectCollider,
  Vec3,
} from "./types";

const STANDING_EYE_HEIGHT = 1.62;
const CROUCH_EYE_HEIGHT = 1.06;
const PLAYER_RADIUS = 0.42;
const ENEMY_EYE_HEIGHT = 1.25;
const GRAVITY = 18;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.1;
const CROUCH_SPEED = 2.65;
const JUMP_SPEED = 6.4;
const PLAYER_DAMAGE_COOLDOWN = 0.22;
const FIRE_INTERVAL = 0.092;
const RIFLE_DAMAGE = 34;
const RIFLE_RANGE = 62;
const DETECTION_RANGE = 21;
const ATTACK_RANGE = 17;
const PLAYER_HIT_DAMAGE = 8;
const LEVEL_TRANSITION_DURATION = 1.55;
const ROUND_END_DURATION = 3;
const ROUND_END_TIME_SCALE = 0.32;
const SPAWN_SHIELD_DURATION = 2.2;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const length2 = (x: number, z: number) => Math.hypot(x, z);
const cloneVec = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const distanceXZ = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

const createPlayer = (spawn: Vec3) => ({
  position: cloneVec(spawn),
  verticalVelocity: 0,
  yaw: 0,
  pitch: 0,
  health: 100,
  maxHealth: 100,
  ammo: 30,
  reserveAmmo: 90,
  magazineSize: 30,
  reloadTimer: 0,
  reloadDuration: 1.35,
  fireCooldown: 0,
  kills: 0,
  grounded: true,
  crouching: false,
  hurtTimer: 0,
  spawnShieldTimer: SPAWN_SHIELD_DURATION,
  recoil: 0,
  shake: 0,
  moveAmount: 0,
});

const createEnemies = (spawns: LevelData["enemySpawns"]): EnemyStateData[] =>
  spawns.map((spawn, index) => ({
    id: spawn.id,
    position: cloneVec(spawn.position),
    yaw: index % 2 === 0 ? Math.PI * 0.2 : -Math.PI * 0.2,
    health: 100,
    maxHealth: 100,
    state: "patrol",
    patrol: spawn.patrol.map(cloneVec),
    patrolIndex: 0,
    attackCooldown: 0.7 + index * 0.18,
    hitFlash: 0,
    deathTimer: 0,
    radius: 0.54,
    speed: 2.25 + (index % 3) * 0.12,
  }));

export class GameSimulation {
  state: GameState;
  private playerDamageCooldown = 0;
  private preparedLevelIndex = 2;
  private preparedLevel = createLevel(this.preparedLevelIndex);
  private preparedEnemies = createEnemies(this.preparedLevel.enemySpawns);

  constructor() {
    this.state = this.createInitialState(1);
  }

  reset() {
    this.state = this.createInitialState(1);
    this.prepareNextLevel(2);
    this.playerDamageCooldown = 0;
  }

  start() {
    this.state.mode = "playing";
    this.state.player.spawnShieldTimer = SPAWN_SHIELD_DURATION;
    this.state.message = this.state.level.theme.objectiveLabel;
    this.state.messageTimer = 2.8;
  }

  getPreparedLevel() {
    return {
      levelIndex: this.preparedLevelIndex,
      level: this.preparedLevel,
      enemies: this.preparedEnemies,
    };
  }

  rotate(deltaX: number, deltaY: number) {
    if (this.state.mode !== "playing") return;
    const sensitivity = 0.00225;
    this.state.player.yaw -= deltaX * sensitivity;
    this.state.player.pitch = clamp(
      this.state.player.pitch - deltaY * sensitivity,
      -Math.PI * 0.475,
      Math.PI * 0.475,
    );
  }

  update(dt: number, input: InputSnapshot): GameEvent[] {
    const events: GameEvent[] = [];
    const state = this.state;
    const gameDt = dt * state.timeScale;
    state.time += gameDt;
    state.messageTimer = Math.max(0, state.messageTimer - dt);

    if (state.mode === "transition") {
      state.transitionProgress = clamp(state.transitionProgress + dt / LEVEL_TRANSITION_DURATION, 0, 1);
      if (state.transitionProgress >= 1) {
        state.mode = "playing";
        state.message = `Level ${state.levelIndex}: ${state.level.theme.objectiveLabel}`;
        state.messageTimer = 2.2;
        events.push({ type: "levelAdvanced", levelIndex: state.levelIndex });
        events.push({ type: "stateChanged", mode: "playing" });
      }
      return events;
    }

    if (state.mode === "roundEnd") {
      this.updatePlayerTimers(gameDt, events);
      events.push(...this.updateEnemies(gameDt));
      state.roundEndTimer = Math.max(0, state.roundEndTimer - dt);
      if (state.roundEndTimer <= 0) {
        this.beginNextLevelTransition(events);
      } else {
        state.message = `ROUND CLEAR - NEXT LEVEL IN ${Math.ceil(state.roundEndTimer)}`;
        state.messageTimer = state.roundEndTimer;
      }
      return events;
    }

    if (state.mode !== "playing") return events;

    this.playerDamageCooldown = Math.max(0, this.playerDamageCooldown - dt);
    this.updatePlayerTimers(dt, events);
    this.updatePlayerMovement(dt, input);
    if (input.reloadPressed) events.push(...this.tryReload());
    events.push(...this.updateEnemies(dt));
    this.checkEndState(events);
    return events;
  }

  tryFire(): GameEvent[] {
    const state = this.state;
    const player = state.player;
    const events: GameEvent[] = [];
    if (state.mode !== "playing" || player.reloadTimer > 0 || player.fireCooldown > 0) return events;

    if (player.ammo <= 0) {
      state.message = player.reserveAmmo > 0 ? "Magazine empty - press R" : "Out of ammo";
      state.messageTimer = 1.2;
      events.push({ type: "empty" });
      return events;
    }

    player.ammo -= 1;
    player.fireCooldown = FIRE_INTERVAL;
    player.recoil = Math.min(1, player.recoil + 0.34);
    player.shake = Math.min(1, player.shake + 0.16);

    const origin = this.getPlayerEye();
    const direction = this.getLookDirection();
    const maxEnd = add(origin, scale(direction, RIFLE_RANGE));
    const wallHit = this.findNearestWallHit(origin, direction, RIFLE_RANGE);
    const enemyHit = this.findNearestEnemyHit(origin, direction, wallHit?.distance ?? RIFLE_RANGE);
    const end = enemyHit ? enemyHit.point : wallHit?.point ?? maxEnd;
    const hit = Boolean(enemyHit || wallHit);

    events.push({ type: "shot", origin, end, hit });

    if (enemyHit) {
      const enemy = enemyHit.enemy;
      enemy.health = Math.max(0, enemy.health - RIFLE_DAMAGE);
      enemy.hitFlash = 0.18;
      enemy.state = enemy.health <= 0 ? "dead" : "chase";
      enemy.attackCooldown = Math.min(enemy.attackCooldown, 0.55);
      events.push({ type: "enemyHit", enemyId: enemy.id, position: enemyHit.point, killed: enemy.health <= 0 });

      if (enemy.health <= 0 && enemy.deathTimer <= 0) {
        enemy.deathTimer = 1.4;
        player.kills += 1;
        state.message = `Guard down ${player.kills}/${state.totalEnemies}`;
        state.messageTimer = 1.2;
        events.push({ type: "enemyKilled", enemyId: enemy.id, position: cloneVec(enemy.position) });
      }
    } else if (wallHit) {
      events.push({ type: "impact", position: wallHit.point, normal: wallHit.normal });
    }

    if (player.ammo === 0 && player.reserveAmmo > 0) {
      state.message = "Magazine empty - press R";
      state.messageTimer = 1.4;
    }

    this.checkEndState(events);
    return events;
  }

  tryReload(): GameEvent[] {
    const player = this.state.player;
    if (
      this.state.mode !== "playing" ||
      player.reloadTimer > 0 ||
      player.ammo >= player.magazineSize ||
      player.reserveAmmo <= 0
    ) {
      return [];
    }

    player.reloadTimer = player.reloadDuration;
    this.state.message = "Reloading";
    this.state.messageTimer = player.reloadDuration;
    return [{ type: "reload" }];
  }

  getPlayerEye(): Vec3 {
    const player = this.state.player;
    return {
      x: player.position.x,
      y: player.position.y + (player.crouching ? CROUCH_EYE_HEIGHT : STANDING_EYE_HEIGHT),
      z: player.position.z,
    };
  }

  getLookDirection(): Vec3 {
    const { yaw, pitch } = this.state.player;
    const cosPitch = Math.cos(pitch);
    return {
      x: -Math.sin(yaw) * cosPitch,
      y: Math.sin(pitch),
      z: -Math.cos(yaw) * cosPitch,
    };
  }

  private createInitialState(levelIndex: number): GameState {
    const level = createLevel(levelIndex);
    const enemies = createEnemies(level.enemySpawns);
    return {
      mode: "menu",
      time: 0,
      levelIndex,
      transitionProgress: 0,
      roundEndTimer: 0,
      timeScale: 1,
      level,
      player: createPlayer(level.playerSpawn),
      enemies,
      totalEnemies: enemies.length,
      message: "",
      messageTimer: 0,
    };
  }

  private updatePlayerTimers(dt: number, events: GameEvent[]) {
    const player = this.state.player;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.spawnShieldTimer = Math.max(0, player.spawnShieldTimer - dt);
    player.recoil = Math.max(0, player.recoil - dt * 3.4);
    player.shake = Math.max(0, player.shake - dt * 4.2);

    if (player.reloadTimer > 0) {
      player.reloadTimer = Math.max(0, player.reloadTimer - dt);
      if (player.reloadTimer === 0) {
        const needed = player.magazineSize - player.ammo;
        const loaded = Math.min(needed, player.reserveAmmo);
        player.ammo += loaded;
        player.reserveAmmo -= loaded;
        this.state.message = "Rifle ready";
        this.state.messageTimer = 0.9;
        events.push({ type: "reloadComplete" });
      }
    }
  }

  private updatePlayerMovement(dt: number, input: InputSnapshot) {
    const player = this.state.player;
    player.crouching = input.crouch && player.grounded;
    const forward = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
    const right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
    const inputX = clamp(input.moveX, -1, 1);
    const inputY = clamp(input.moveY, -1, 1);
    let moveX = forward.x * inputY + right.x * inputX;
    let moveZ = forward.z * inputY + right.z * inputX;

    const moveLength = length2(moveX, moveZ);
    const moveAmount = clamp(moveLength, 0, 1);
    player.moveAmount = moveAmount;
    if (moveLength > 0) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }

    const speed = player.crouching ? CROUCH_SPEED : input.sprint && inputY > 0.05 ? SPRINT_SPEED : WALK_SPEED;
    player.position.x += moveX * speed * moveAmount * dt;
    player.position.z += moveZ * speed * moveAmount * dt;
    this.resolveCircle(player.position, PLAYER_RADIUS);

    if (input.jumpPressed && player.grounded && !player.crouching) {
      player.verticalVelocity = JUMP_SPEED;
      player.grounded = false;
    }

    player.verticalVelocity -= GRAVITY * dt;
    player.position.y += player.verticalVelocity * dt;

    if (player.position.y <= 0) {
      player.position.y = 0;
      player.verticalVelocity = 0;
      player.grounded = true;
    }
  }

  private updateEnemies(dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const player = this.state.player;
    const playerEye = this.getPlayerEye();

    for (const enemy of this.state.enemies) {
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (enemy.state === "dead") {
        enemy.deathTimer = Math.max(0, enemy.deathTimer - dt);
        continue;
      }

      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      const enemyEye = { x: enemy.position.x, y: ENEMY_EYE_HEIGHT, z: enemy.position.z };
      const dist = distanceXZ(enemy.position, player.position);
      const canSeePlayer = dist < DETECTION_RANGE && !this.isSightBlocked(enemyEye, playerEye);

      if (canSeePlayer && dist <= ATTACK_RANGE) {
        enemy.state = "attack";
      } else if (canSeePlayer) {
        enemy.state = "chase";
      } else if (enemy.state !== "patrol") {
        enemy.state = "patrol";
      }

      if (enemy.state === "attack") {
        this.faceTarget(enemy, player.position);
        if (dist > 10.5) this.moveEnemyToward(enemy, player.position, enemy.speed * 0.55 * dt);
        if (enemy.attackCooldown <= 0 && canSeePlayer) {
          enemy.attackCooldown = 1.2 + Math.random() * 0.45;
          events.push(...this.damagePlayer(enemy));
        }
      } else if (enemy.state === "chase") {
        this.faceTarget(enemy, player.position);
        this.moveEnemyToward(enemy, player.position, enemy.speed * 1.16 * dt);
      } else {
        const target = enemy.patrol[enemy.patrolIndex];
        this.faceTarget(enemy, target);
        this.moveEnemyToward(enemy, target, enemy.speed * 0.62 * dt);
        if (distanceXZ(enemy.position, target) < 0.45) {
          enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.patrol.length;
        }
      }
    }

    return events;
  }

  private damagePlayer(enemy: EnemyStateData): GameEvent[] {
    const player = this.state.player;
    if (this.playerDamageCooldown > 0 || player.spawnShieldTimer > 0) return [];
    this.playerDamageCooldown = PLAYER_DAMAGE_COOLDOWN;
    player.health = Math.max(0, player.health - PLAYER_HIT_DAMAGE);
    player.hurtTimer = 0.65;
    player.shake = Math.min(1, player.shake + 0.38);
    this.state.message = "Armor hit";
    this.state.messageTimer = 0.55;
    return [
      {
        type: "playerHit",
        from: cloneVec(enemy.position),
        damage: PLAYER_HIT_DAMAGE,
        position: this.getPlayerEye(),
      },
    ];
  }

  private checkEndState(events: GameEvent[]) {
    const state = this.state;
    if (state.mode !== "playing") return;

    if (state.player.health <= 0) {
      this.changeMode("dead", events);
      return;
    }

    if (state.enemies.every((enemy) => enemy.state === "dead")) {
      this.beginRoundEnd(events);
    }
  }

  private beginRoundEnd(events: GameEvent[]) {
    const state = this.state;
    state.mode = "roundEnd";
    state.roundEndTimer = ROUND_END_DURATION;
    state.timeScale = ROUND_END_TIME_SCALE;
    state.message = `ROUND CLEAR - NEXT LEVEL IN ${Math.ceil(ROUND_END_DURATION)}`;
    state.messageTimer = ROUND_END_DURATION;
    state.player.moveAmount = 0;
    events.push({ type: "stateChanged", mode: "roundEnd" });
  }

  private beginNextLevelTransition(events: GameEvent[]) {
    const state = this.state;
    const nextLevelIndex = state.levelIndex + 1;
    if (this.preparedLevelIndex !== nextLevelIndex) this.prepareNextLevel(nextLevelIndex);
    const nextLevel = this.preparedLevel;
    const nextEnemies = this.preparedEnemies;
    const player = state.player;
    state.levelIndex = nextLevelIndex;
    state.level = nextLevel;
    state.enemies = nextEnemies;
    state.totalEnemies = nextEnemies.length;
    state.transitionProgress = 0;
    state.roundEndTimer = 0;
    state.timeScale = 1;
    state.mode = "transition";
    state.message = `Loading level ${nextLevelIndex}`;
    state.messageTimer = LEVEL_TRANSITION_DURATION;

    player.position = cloneVec(nextLevel.playerSpawn);
    player.verticalVelocity = 0;
    player.grounded = true;
    player.crouching = false;
    player.yaw = 0;
    player.pitch = 0;
    player.health = Math.min(player.maxHealth, player.health + 30);
    player.ammo = player.magazineSize;
    player.reserveAmmo = Math.min(180, player.reserveAmmo + 30);
    player.reloadTimer = 0;
    player.fireCooldown = 0;
    player.spawnShieldTimer = SPAWN_SHIELD_DURATION;
    player.recoil = 0;
    player.shake = 0;
    player.moveAmount = 0;
    this.playerDamageCooldown = 0;
    this.prepareNextLevel(nextLevelIndex + 1);

    events.push({ type: "stateChanged", mode: "transition" });
  }

  private prepareNextLevel(levelIndex: number) {
    this.preparedLevelIndex = levelIndex;
    this.preparedLevel = createLevel(levelIndex);
    this.preparedEnemies = createEnemies(this.preparedLevel.enemySpawns);
  }

  private changeMode(mode: GameMode, events: GameEvent[]) {
    this.state.mode = mode;
    events.push({ type: "stateChanged", mode });
  }

  private moveEnemyToward(enemy: EnemyStateData, target: Vec3, amount: number) {
    const dx = target.x - enemy.position.x;
    const dz = target.z - enemy.position.z;
    const dist = length2(dx, dz);
    if (dist < 0.001) return;
    enemy.position.x += (dx / dist) * amount;
    enemy.position.z += (dz / dist) * amount;
    this.resolveCircle(enemy.position, enemy.radius);
  }

  private faceTarget(enemy: EnemyStateData, target: Vec3) {
    enemy.yaw = Math.atan2(enemy.position.x - target.x, enemy.position.z - target.z);
  }

  private resolveCircle(position: Vec3, radius: number) {
    for (const collider of this.state.level.colliders) {
      const halfW = collider.width / 2;
      const halfD = collider.depth / 2;
      const minX = collider.x - halfW;
      const maxX = collider.x + halfW;
      const minZ = collider.z - halfD;
      const maxZ = collider.z + halfD;
      const closestX = clamp(position.x, minX, maxX);
      const closestZ = clamp(position.z, minZ, maxZ);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distance = Math.hypot(dx, dz);

      if (distance < radius) {
        const push = radius - distance;
        if (distance > 0.0001) {
          position.x += (dx / distance) * push;
          position.z += (dz / distance) * push;
        } else {
          const left = Math.abs(position.x - minX);
          const right = Math.abs(maxX - position.x);
          const top = Math.abs(position.z - minZ);
          const bottom = Math.abs(maxZ - position.z);
          const nearest = Math.min(left, right, top, bottom);
          if (nearest === left) position.x = minX - radius;
          else if (nearest === right) position.x = maxX + radius;
          else if (nearest === top) position.z = minZ - radius;
          else position.z = maxZ + radius;
        }
      }
    }
  }

  private findNearestEnemyHit(origin: Vec3, direction: Vec3, maxDistance: number) {
    let nearest:
      | {
          enemy: EnemyStateData;
          distance: number;
          point: Vec3;
        }
      | undefined;

    for (const enemy of this.state.enemies) {
      if (enemy.state === "dead") continue;
      const center = { x: enemy.position.x, y: 1.08, z: enemy.position.z };
      const radius = 0.72;
      const distance = raySphere(origin, direction, center, radius);
      if (distance === undefined || distance > maxDistance) continue;
      if (!nearest || distance < nearest.distance) {
        nearest = { enemy, distance, point: add(origin, scale(direction, distance)) };
      }
    }

    return nearest;
  }

  private findNearestWallHit(origin: Vec3, direction: Vec3, maxDistance: number) {
    let nearest:
      | {
          collider: RectCollider;
          distance: number;
          point: Vec3;
          normal: Vec3;
        }
      | undefined;

    for (const collider of this.state.level.colliders) {
      const hit = rayAabb(origin, direction, collider, maxDistance);
      if (!hit) continue;
      if (!nearest || hit.distance < nearest.distance) {
        nearest = { collider, ...hit };
      }
    }

    return nearest;
  }

  private isSightBlocked(from: Vec3, to: Vec3) {
    const direction = {
      x: to.x - from.x,
      y: to.y - from.y,
      z: to.z - from.z,
    };
    const distance = Math.hypot(direction.x, direction.y, direction.z);
    if (distance < 0.001) return false;
    direction.x /= distance;
    direction.y /= distance;
    direction.z /= distance;
    const hit = this.findNearestWallHit(from, direction, distance);
    return Boolean(hit && hit.distance < distance - 0.2);
  }
}

const raySphere = (origin: Vec3, direction: Vec3, center: Vec3, radius: number) => {
  const oc = {
    x: origin.x - center.x,
    y: origin.y - center.y,
    z: origin.z - center.z,
  };
  const b = oc.x * direction.x + oc.y * direction.y + oc.z * direction.z;
  const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return undefined;
  const distance = -b - Math.sqrt(discriminant);
  return distance > 0 ? distance : undefined;
};

const rayAabb = (origin: Vec3, direction: Vec3, collider: RectCollider, maxDistance: number) => {
  const min = {
    x: collider.x - collider.width / 2,
    y: 0,
    z: collider.z - collider.depth / 2,
  };
  const max = {
    x: collider.x + collider.width / 2,
    y: collider.height,
    z: collider.z + collider.depth / 2,
  };
  let tMin = 0;
  let tMax = maxDistance;
  let normal: Vec3 = { x: 0, y: 0, z: 0 };

  const axisCheck = (axis: keyof Vec3) => {
    const originAxis = origin[axis];
    const directionAxis = direction[axis];
    if (Math.abs(directionAxis) < 0.00001) {
      return originAxis >= min[axis] && originAxis <= max[axis];
    }
    const inv = 1 / directionAxis;
    let t1 = (min[axis] - originAxis) * inv;
    let t2 = (max[axis] - originAxis) * inv;
    let axisNormal: Vec3 = { x: 0, y: 0, z: 0 };
    axisNormal[axis] = inv >= 0 ? -1 : 1;
    if (t1 > t2) {
      const swap = t1;
      t1 = t2;
      t2 = swap;
      axisNormal[axis] *= -1;
    }
    if (t1 > tMin) {
      tMin = t1;
      normal = axisNormal;
    }
    tMax = Math.min(tMax, t2);
    return tMin <= tMax;
  };

  if (!axisCheck("x") || !axisCheck("y") || !axisCheck("z")) return undefined;
  if (tMin < 0 || tMin > maxDistance) return undefined;
  return {
    distance: tMin,
    point: add(origin, scale(direction, tMin)),
    normal,
  };
};
