export type GameMode = "menu" | "playing" | "transition" | "dead" | "victory";
export type EnemyState = "patrol" | "chase" | "attack" | "dead";
export type ColliderKind =
  | "wall"
  | "glassWall"
  | "cover"
  | "bench"
  | "kiosk"
  | "counter"
  | "planter"
  | "sign"
  | "adScreen"
  | "pillar"
  | "lowWall"
  | "divider"
  | "table"
  | "shelf"
  | "stall"
  | "vending"
  | "trash"
  | "sculpture"
  | "chair";
export type PublicSceneType = "metro" | "airport" | "mall" | "hospital" | "library";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RectCollider {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  kind: ColliderKind;
  label?: string;
}

export interface LevelTheme {
  type: PublicSceneType;
  name: string;
  objectiveLabel: string;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  secondaryAccent: string;
  signageColor: string;
}

export interface PlayerState {
  position: Vec3;
  verticalVelocity: number;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  ammo: number;
  reserveAmmo: number;
  magazineSize: number;
  reloadTimer: number;
  reloadDuration: number;
  fireCooldown: number;
  kills: number;
  grounded: boolean;
  hurtTimer: number;
  spawnShieldTimer: number;
  recoil: number;
  shake: number;
  moveAmount: number;
}

export interface EnemyStateData {
  id: string;
  position: Vec3;
  yaw: number;
  health: number;
  maxHealth: number;
  state: EnemyState;
  patrol: Vec3[];
  patrolIndex: number;
  attackCooldown: number;
  hitFlash: number;
  deathTimer: number;
  radius: number;
  speed: number;
}

export interface LevelData {
  theme: LevelTheme;
  layoutName: string;
  colliders: RectCollider[];
  enemySpawns: Array<{
    id: string;
    position: Vec3;
    patrol: Vec3[];
  }>;
  playerSpawn: Vec3;
}

export interface GameState {
  mode: GameMode;
  time: number;
  levelIndex: number;
  transitionProgress: number;
  level: LevelData;
  player: PlayerState;
  enemies: EnemyStateData[];
  totalEnemies: number;
  message: string;
  messageTimer: number;
}

export interface InputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpPressed: boolean;
  reloadPressed: boolean;
  firePressed: boolean;
}

export type GameEvent =
  | { type: "shot"; origin: Vec3; end: Vec3; hit: boolean }
  | { type: "empty" }
  | { type: "reload" }
  | { type: "reloadComplete" }
  | { type: "enemyHit"; enemyId: string; position: Vec3; killed: boolean }
  | { type: "enemyKilled"; enemyId: string; position: Vec3 }
  | { type: "impact"; position: Vec3; normal?: Vec3 }
  | { type: "playerHit"; from: Vec3; damage: number; position: Vec3 }
  | { type: "levelAdvanced"; levelIndex: number }
  | { type: "stateChanged"; mode: GameMode };
