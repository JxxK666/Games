import * as THREE from "three";
import type { EnemyStateData, GameEvent, GameState, LevelData, LevelTheme, RectCollider, Vec3 } from "../game/types";

type EnemyView = {
  group: THREE.Group;
  body: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  core: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  light: THREE.PointLight;
};

type TimedObject = {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  update?: (ratio: number, dt: number) => void;
};

type PreloadedLevel = {
  levelIndex: number;
  levelGroup: THREE.Group;
  lightGroup: THREE.Group;
};

const vecToThree = (v: Vec3) => new THREE.Vector3(v.x, v.y, v.z);

const disposeMaterial = (material: THREE.Material) => {
  const withMaps = material as THREE.Material & {
    map?: THREE.Texture;
    emissiveMap?: THREE.Texture;
    normalMap?: THREE.Texture;
    roughnessMap?: THREE.Texture;
    metalnessMap?: THREE.Texture;
  };
  withMaps.map?.dispose();
  withMaps.emissiveMap?.dispose();
  withMaps.normalMap?.dispose();
  withMaps.roughnessMap?.dispose();
  withMaps.metalnessMap?.dispose();
  material.dispose();
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else disposeMaterial(material);
    }
  });
};

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly scene: THREE.Scene;
  private readonly clock = new THREE.Clock();
  private readonly enemyViews = new Map<string, EnemyView>();
  private readonly timedObjects: TimedObject[] = [];
  private readonly levelGroup = new THREE.Group();
  private readonly lightGroup = new THREE.Group();
  private readonly weapon = new THREE.Group();
  private readonly muzzleLight = new THREE.PointLight(0xfff0ad, 0, 9, 2);
  private readonly muzzleFlare: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly enemyBeamMaterial = new THREE.LineBasicMaterial({
    color: 0xff365e,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });
  private bobPhase = 0;
  private cameraEyeHeight = 1.62;
  private muzzleTimer = 0;
  private readonly baseWeaponPosition = new THREE.Vector3(0.38, -0.34, -0.58);
  private preloadedLevel?: PreloadedLevel;

  constructor(private readonly root: HTMLElement, initialState: GameState) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#eaf6ff");
    this.scene.fog = new THREE.FogExp2("#e9f5ff", 0.011);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 140);
    this.camera.rotation.order = "YXZ";
    this.camera.position.set(0, 1.62, 16);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: new URLSearchParams(window.location.search).has("qa"),
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.root.appendChild(this.renderer.domElement);

    this.muzzleFlare = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 12, 8),
      new THREE.MeshBasicMaterial({
        color: "#ffd36b",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );

    this.scene.add(this.levelGroup);
    this.scene.add(this.lightGroup);
    this.createLights(initialState.level.theme);
    this.buildLevel(initialState.level);
    this.createWeapon();
    this.createEnemies(initialState.enemies);
    this.bindBrowserEvents();
  }

  reset(state: GameState) {
    this.clearEnemies();
    if (!this.activatePreloadedLevel(state.levelIndex)) {
      this.clearLevel();
      this.clearLights();
      this.createLights(state.level.theme);
      this.buildLevel(state.level);
    }
    this.createEnemies(state.enemies);
    this.clearTimedObjects();
    this.muzzleTimer = 0;
    this.cameraEyeHeight = state.player.crouching ? 1.06 : 1.62;
  }

  preloadLevel(levelIndex: number, level: LevelData) {
    this.clearPreloadedLevel();
    const levelGroup = new THREE.Group();
    const lightGroup = new THREE.Group();
    this.buildLevel(level, levelGroup);
    this.createLights(level.theme, lightGroup);
    this.scene.add(levelGroup, lightGroup);
    this.renderer.compile(this.scene, this.camera);
    levelGroup.visible = false;
    lightGroup.visible = false;
    this.preloadedLevel = { levelIndex, levelGroup, lightGroup };
  }

  nextDelta() {
    return Math.min(0.05, this.clock.getDelta());
  }

  update(state: GameState, dt: number) {
    this.syncCamera(state, dt);
    this.syncEnemies(state.enemies);
    this.updateEffects(dt);
    this.renderer.render(this.scene, this.camera);
  }

  handleEvents(events: GameEvent[]) {
    for (const event of events) {
      if (event.type === "shot") {
        this.spawnTracer(event.origin, event.end);
        this.muzzleTimer = 0.07;
      }
      if (event.type === "impact") this.spawnSparks(event.position, "#7ee7ff", 7);
      if (event.type === "enemyHit") this.spawnSparks(event.position, event.killed ? "#ffea9b" : "#ff4c7d", 10);
      if (event.type === "enemyKilled") this.spawnBurst(event.position);
      if (event.type === "playerHit") this.spawnEnemyBeam(event.from, event.position);
    }
  }

  private createLights(theme: LevelTheme, target = this.lightGroup) {
    const ambient = new THREE.AmbientLight("#ffffff", 1.05);
    target.add(ambient);

    const hemi = new THREE.HemisphereLight("#fbfdff", theme.wallColor, 1.45);
    target.add(hemi);

    const key = new THREE.DirectionalLight("#ffffff", 2.45);
    key.position.set(6, 14, 9);
    key.castShadow = false;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 60;
    key.shadow.camera.left = -28;
    key.shadow.camera.right = 28;
    key.shadow.camera.top = 28;
    key.shadow.camera.bottom = -28;
    target.add(key);

    const lightPositions: Array<[number, number, number, string, number]> = [
      [-15, 4.9, -15, "#ffffff", 17],
      [15, 4.9, -15, "#ffffff", 17],
      [-15, 4.9, 11, "#ffffff", 15],
      [15, 4.9, 11, "#ffffff", 15],
      [0, 5.15, -2, theme.accentColor, 10],
    ];

    for (const [x, y, z, color, intensity] of lightPositions) {
      const point = new THREE.PointLight(color, intensity, 30, 1.8);
      point.position.set(x, y, z);
      point.castShadow = false;
      target.add(point);
      const bulb = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.08, 1.15),
        new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.82 }),
      );
      bulb.position.copy(point.position);
      target.add(bulb);
    }
  }

  private buildLevel(level: LevelData, target = this.levelGroup) {
    const { theme, colliders } = level;
    const floorTexture = createFloorTexture(theme);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46, 18, 18),
      new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: theme.floorColor,
        metalness: 0.18,
        roughness: 0.42,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    target.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46, 1, 1),
      new THREE.MeshStandardMaterial({
        color: "#f8fbff",
        metalness: 0.05,
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.65;
    ceiling.receiveShadow = true;
    target.add(ceiling);

    const wallMat = new THREE.MeshStandardMaterial({
      color: theme.wallColor,
      metalness: 0.08,
      roughness: 0.48,
    });
    const coverMat = new THREE.MeshStandardMaterial({
      color: "#b9c4ca",
      metalness: 0.22,
      roughness: 0.38,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: "#d0d7dd",
      metalness: 0.2,
      roughness: 0.28,
    });
    const benchMat = new THREE.MeshStandardMaterial({
      color: "#5f7585",
      metalness: 0.25,
      roughness: 0.38,
    });
    const kioskMat = new THREE.MeshStandardMaterial({
      color: "#f7f9fb",
      metalness: 0.18,
      roughness: 0.24,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: "#ccefff",
      metalness: 0,
      roughness: 0.05,
      transmission: 0.45,
      transparent: true,
      opacity: 0.38,
    });
    const screenMat = new THREE.MeshBasicMaterial({
      color: theme.accentColor,
      transparent: true,
      opacity: 0.92,
    });
    const planterMat = new THREE.MeshStandardMaterial({
      color: "#7e8d73",
      metalness: 0.05,
      roughness: 0.6,
    });
    const lowWallMat = new THREE.MeshStandardMaterial({
      color: "#aab7bf",
      metalness: 0.28,
      roughness: 0.36,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: "#9c7651",
      metalness: 0.06,
      roughness: 0.58,
    });
    const vendingMat = new THREE.MeshStandardMaterial({
      color: "#d9e4ea",
      metalness: 0.24,
      roughness: 0.26,
    });
    const trashMat = new THREE.MeshStandardMaterial({
      color: "#46535c",
      metalness: 0.34,
      roughness: 0.4,
    });
    const sculptureMat = new THREE.MeshStandardMaterial({
      color: theme.secondaryAccent,
      emissive: theme.accentColor,
      emissiveIntensity: 0.22,
      metalness: 0.36,
      roughness: 0.32,
    });

    for (const collider of colliders) {
      const material =
        collider.kind === "wall"
          ? wallMat
          : collider.kind === "glassWall"
            ? glassMat
            : collider.kind === "pillar"
              ? pillarMat
              : collider.kind === "bench"
                ? benchMat
                : collider.kind === "kiosk" || collider.kind === "counter"
                  ? kioskMat
                  : collider.kind === "adScreen" || collider.kind === "sign"
                    ? screenMat
                    : collider.kind === "planter"
                      ? planterMat
                      : collider.kind === "lowWall" || collider.kind === "divider"
                        ? lowWallMat
                        : collider.kind === "table" ||
                            collider.kind === "shelf" ||
                            collider.kind === "stall" ||
                            collider.kind === "chair"
                          ? woodMat
                          : collider.kind === "vending"
                            ? vendingMat
                            : collider.kind === "trash"
                              ? trashMat
                              : collider.kind === "sculpture"
                                ? sculptureMat
                                : coverMat;

      let geometry: THREE.BufferGeometry;
      let meshHeight = collider.height / 2;
      if (collider.kind === "pillar") {
        geometry = new THREE.CylinderGeometry(collider.width / 2, collider.width / 2, collider.height, 8);
      } else if (collider.kind === "trash") {
        geometry = new THREE.CylinderGeometry(collider.width / 2, collider.width * 0.42, collider.height, 8);
      } else if (collider.kind === "sculpture") {
        geometry = new THREE.DodecahedronGeometry(Math.max(collider.width, collider.depth) * 0.46, 0);
      } else if (collider.kind === "table") {
        geometry = new THREE.BoxGeometry(collider.width, 0.16, collider.depth);
        meshHeight = collider.height - 0.08;
      } else if (collider.kind === "chair") {
        geometry = new THREE.BoxGeometry(collider.width, 0.14, collider.depth);
        meshHeight = collider.height * 0.54;
      } else {
        geometry = new THREE.BoxGeometry(collider.width, collider.height, collider.depth);
      }

      const mesh = new THREE.Mesh(geometry, material);
      if (collider.kind === "sculpture") {
        mesh.scale.y = Math.max(0.9, collider.height / Math.max(collider.width, collider.depth));
      }
      mesh.position.set(collider.x, meshHeight, collider.z);
      mesh.castShadow = !["glassWall", "sign", "adScreen"].includes(collider.kind);
      mesh.receiveShadow = true;
      target.add(mesh);
      this.addPublicDetail(collider, theme, target);
    }
  }

  private addPublicDetail(collider: RectCollider, theme: LevelTheme, target = this.levelGroup) {
    if (collider.kind === "wall" || collider.kind === "glassWall") return;
    if (collider.kind === "planter") {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.15, 0.55, 6),
        new THREE.MeshStandardMaterial({ color: "#6f5137", roughness: 0.7 }),
      );
      trunk.position.set(collider.x, collider.height + 0.08, collider.z);
      trunk.castShadow = true;
      target.add(trunk);

      const plant = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.62, 0),
        new THREE.MeshStandardMaterial({ color: "#3f9a59", roughness: 0.65 }),
      );
      plant.position.set(collider.x, collider.height + 0.56, collider.z);
      plant.scale.set(1.25, 0.82, 1.25);
      plant.castShadow = true;
      target.add(plant);
      return;
    }

    if (collider.label && ["sign", "adScreen", "kiosk", "vending", "counter", "stall", "shelf"].includes(collider.kind)) {
      const label = this.createLabelPlane(collider.label, theme, collider);
      target.add(label);
    }

    if (collider.kind === "bench") this.addBenchDetails(collider, theme, target);
    if (collider.kind === "kiosk" || collider.kind === "vending") this.addMachineDetails(collider, theme, target);
    if (collider.kind === "counter" || collider.kind === "table" || collider.kind === "chair") {
      this.addFurnitureDetails(collider, theme, target);
    }
    if (collider.kind === "shelf") this.addShelfDetails(collider, theme, target);
    if (collider.kind === "stall") this.addStallDetails(collider, theme, target);
    if (collider.kind === "divider") this.addDividerDetails(collider, theme, target);
    if (collider.kind === "trash") this.addTrashDetails(collider, target);
    if (collider.kind === "sculpture") this.addSculptureDetails(collider, theme, target);

    if (["bench", "cover", "counter", "kiosk", "lowWall", "divider", "table", "shelf", "stall", "vending"].includes(collider.kind)) {
      this.addAccentEdge(collider, theme, target);
    }
  }

  private addDetailBox(
    collider: RectCollider,
    target: THREE.Group,
    size: [number, number, number],
    offset: [number, number, number],
    color: string,
    metalness = 0.12,
    roughness = 0.48,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshStandardMaterial({ color, metalness, roughness }),
    );
    mesh.position.set(collider.x + offset[0], offset[1], collider.z + offset[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    target.add(mesh);
  }

  private addBenchDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    const horizontal = collider.width >= collider.depth;
    const backOffset = horizontal ? [0, collider.height + 0.22, collider.depth * 0.45] : [collider.width * 0.45, collider.height + 0.22, 0];
    this.addDetailBox(
      collider,
      target,
      horizontal ? [collider.width * 0.94, 0.48, 0.12] : [0.12, 0.48, collider.depth * 0.94],
      backOffset as [number, number, number],
      "#506879",
      0.22,
      0.38,
    );

    const legColor = "#32424c";
    const xOffsets = horizontal ? [-collider.width * 0.38, collider.width * 0.38] : [-collider.width * 0.24, collider.width * 0.24];
    const zOffsets = horizontal ? [-collider.depth * 0.22, collider.depth * 0.22] : [-collider.depth * 0.38, collider.depth * 0.38];
    for (const x of xOffsets) {
      for (const z of zOffsets) {
        this.addDetailBox(collider, target, [0.12, 0.5, 0.12], [x, 0.25, z], legColor, 0.28, 0.36);
      }
    }

    this.addDetailBox(
      collider,
      target,
      horizontal ? [collider.width * 0.8, 0.035, 0.08] : [0.08, 0.035, collider.depth * 0.8],
      [0, collider.height + 0.02, 0],
      theme.secondaryAccent,
      0.1,
      0.25,
    );
  }

  private addMachineDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    const horizontal = collider.width >= collider.depth;
    const screenSize: [number, number, number] = horizontal
      ? [collider.width * 0.55, 0.72, 0.035]
      : [0.035, 0.72, collider.depth * 0.55];
    const screenOffset: [number, number, number] = horizontal
      ? [0, collider.height * 0.58, collider.depth / 2 + 0.025]
      : [collider.width / 2 + 0.025, collider.height * 0.58, 0];
    this.addDetailBox(collider, target, screenSize, screenOffset, theme.accentColor, 0.04, 0.2);
    this.addDetailBox(
      collider,
      target,
      horizontal ? [collider.width * 0.32, 0.1, 0.045] : [0.045, 0.1, collider.depth * 0.32],
      horizontal ? [0, collider.height * 0.25, collider.depth / 2 + 0.03] : [collider.width / 2 + 0.03, collider.height * 0.25, 0],
      theme.secondaryAccent,
      0.05,
      0.24,
    );
  }

  private addFurnitureDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    if (collider.kind === "table") {
      const legHeight = Math.max(0.42, collider.height - 0.12);
      for (const x of [-collider.width * 0.42, collider.width * 0.42]) {
        for (const z of [-collider.depth * 0.36, collider.depth * 0.36]) {
          this.addDetailBox(collider, target, [0.12, legHeight, 0.12], [x, legHeight / 2, z], "#59636a", 0.28, 0.34);
        }
      }

      if (collider.label?.includes("Workstation")) {
        const screenXs = collider.width > 4 ? [-collider.width * 0.24, collider.width * 0.24] : [0];
        for (const x of screenXs) {
          this.addDetailBox(collider, target, [0.74, 0.46, 0.065], [x, collider.height + 0.29, 0], "#26343c", 0.25, 0.2);
          this.addDetailBox(collider, target, [0.08, 0.24, 0.08], [x, collider.height + 0.12, 0], "#65737b", 0.38, 0.28);
        }
      }
      return;
    }

    if (collider.kind === "chair") {
      const chairCount = Math.max(1, Math.round(collider.width / 0.9));
      const spacing = collider.width / chairCount;
      for (let i = 0; i < chairCount; i += 1) {
        const x = -collider.width / 2 + spacing * (i + 0.5);
        this.addDetailBox(collider, target, [Math.min(0.68, spacing * 0.78), 0.5, 0.11], [x, collider.height * 0.78, collider.depth * 0.43], "#34434c", 0.18, 0.46);
        this.addDetailBox(collider, target, [0.09, collider.height * 0.48, 0.09], [x, collider.height * 0.25, 0], "#46535b", 0.3, 0.34);
      }
      return;
    }

    this.addDetailBox(collider, target, [collider.width * 1.04, 0.12, collider.depth * 1.04], [0, collider.height + 0.02, 0], "#b58b61", 0.05, 0.45);
    this.addDetailBox(collider, target, [collider.width * 0.55, 0.04, 0.055], [0, collider.height + 0.1, -collider.depth * 0.47], theme.accentColor, 0.08, 0.24);
  }

  private addDividerDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    const horizontal = collider.width >= collider.depth;
    this.addDetailBox(
      collider,
      target,
      horizontal ? [collider.width * 1.02, 0.07, collider.depth * 1.18] : [collider.width * 1.18, 0.07, collider.depth * 1.02],
      [0, collider.height - 0.035, 0],
      theme.accentColor,
      0.22,
      0.3,
    );

    const ends = horizontal ? [-collider.width * 0.48, collider.width * 0.48] : [-collider.depth * 0.48, collider.depth * 0.48];
    for (const end of ends) {
      this.addDetailBox(
        collider,
        target,
        horizontal ? [0.08, collider.height, collider.depth * 1.18] : [collider.width * 1.18, collider.height, 0.08],
        horizontal ? [end, collider.height / 2, 0] : [0, collider.height / 2, end],
        "#64747c",
        0.3,
        0.32,
      );
    }
  }

  private addShelfDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    const horizontal = collider.width >= collider.depth;
    const rows = [0.36, 0.68, 0.98, 1.22].filter((y) => y < collider.height - 0.08);
    for (const y of rows) {
      this.addDetailBox(
        collider,
        target,
        horizontal ? [collider.width * 0.86, 0.06, 0.08] : [0.08, 0.06, collider.depth * 0.86],
        horizontal ? [0, y, -collider.depth * 0.48] : [-collider.width * 0.48, y, 0],
        y > 0.9 ? theme.secondaryAccent : "#e6d2a8",
        0.04,
        0.55,
      );
    }
  }

  private addStallDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    this.addDetailBox(collider, target, [collider.width * 1.12, 0.16, collider.depth * 1.1], [0, collider.height + 0.2, 0], theme.secondaryAccent, 0.08, 0.32);
    const postColor = "#6d5361";
    for (const x of [-collider.width * 0.42, collider.width * 0.42]) {
      for (const z of [-collider.depth * 0.38, collider.depth * 0.38]) {
        this.addDetailBox(collider, target, [0.09, collider.height * 0.82, 0.09], [x, collider.height * 0.42, z], postColor, 0.1, 0.44);
      }
    }
    this.addDetailBox(collider, target, [collider.width * 0.64, 0.08, collider.depth * 0.12], [0, collider.height * 0.72, collider.depth * 0.52], theme.accentColor, 0.08, 0.28);
  }

  private addTrashDetails(collider: RectCollider, target: THREE.Group) {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(collider.width * 0.36, 0.035, 6, 8),
      new THREE.MeshStandardMaterial({ color: "#9fb1ba", metalness: 0.35, roughness: 0.32 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(collider.x, collider.height + 0.03, collider.z);
    rim.castShadow = true;
    target.add(rim);
  }

  private addSculptureDetails(collider: RectCollider, theme: LevelTheme, target: THREE.Group) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(collider.width * 0.34, collider.width * 0.42, 0.28, 7),
      new THREE.MeshStandardMaterial({ color: "#58636d", metalness: 0.26, roughness: 0.34 }),
    );
    base.position.set(collider.x, 0.14, collider.z);
    base.castShadow = true;
    base.receiveShadow = true;
    target.add(base);

    const glow = new THREE.PointLight(theme.accentColor, 1.4, 5.5, 2);
    glow.position.set(collider.x, collider.height + 0.25, collider.z);
    target.add(glow);
  }

  private addAccentEdge(collider: RectCollider, theme: LevelTheme, target = this.levelGroup) {
    const color = collider.kind === "bench" ? theme.secondaryAccent : theme.accentColor;
    const stripMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    const horizontal = collider.width >= collider.depth;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(
        horizontal ? Math.max(0.5, collider.width * 0.64) : 0.055,
        0.055,
        horizontal ? 0.055 : Math.max(0.5, collider.depth * 0.64),
      ),
      stripMat,
    );
    strip.position.set(collider.x, Math.min(collider.height - 0.22, 1.85), collider.z);
    target.add(strip);
  }

  private createLabelPlane(text: string, theme: LevelTheme, collider: RectCollider) {
    const texture = createLabelTexture(text, theme);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(Math.max(collider.width, collider.depth), 5.6), 0.72),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    );
    const facesNorthSouth = collider.width >= collider.depth;
    plane.position.set(collider.x, Math.min(collider.height + 0.08, 2.75), collider.z);
    if (facesNorthSouth) {
      plane.position.z += collider.z > 0 ? -collider.depth / 2 - 0.025 : collider.depth / 2 + 0.025;
    } else {
      plane.rotation.y = Math.PI / 2;
      plane.position.x += collider.x > 0 ? -collider.width / 2 - 0.025 : collider.width / 2 + 0.025;
    }
    return plane;
  }

  private createWeapon() {
    this.weapon.position.copy(this.baseWeaponPosition);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#15191e",
      metalness: 0.92,
      roughness: 0.22,
    });
    const accentMat = new THREE.MeshBasicMaterial({
      color: "#28d6ff",
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.62), bodyMat);
    receiver.castShadow = true;
    receiver.position.set(0, 0, 0);
    this.weapon.add(receiver);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.52), bodyMat);
    barrel.position.set(0.02, 0.035, -0.56);
    this.weapon.add(barrel);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.16), bodyMat);
    grip.position.set(0.03, -0.24, 0.12);
    grip.rotation.x = -0.28;
    this.weapon.add(grip);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.42), accentMat);
    strip.position.set(0, 0.115, -0.08);
    this.weapon.add(strip);

    this.muzzleFlare.position.set(0.02, 0.04, -0.86);
    this.weapon.add(this.muzzleFlare);
    this.muzzleLight.position.copy(this.muzzleFlare.position);
    this.weapon.add(this.muzzleLight);
    this.camera.add(this.weapon);
  }

  private createEnemies(enemies: EnemyStateData[]) {
    for (const enemy of enemies) {
      const view = this.createEnemyView(enemy);
      this.enemyViews.set(enemy.id, view);
      this.scene.add(view.group);
    }
  }

  private createEnemyView(enemy: EnemyStateData): EnemyView {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#7b263f",
      emissive: "#2a0010",
      metalness: 0.68,
      roughness: 0.28,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: "#351820",
      emissive: "#ff174f",
      emissiveIntensity: 0.65,
      metalness: 0.5,
      roughness: 0.25,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: "#ff517f",
      emissive: "#ff255f",
      emissiveIntensity: 1.2,
      metalness: 0.2,
      roughness: 0.18,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 1.36, 12), bodyMat);
    body.position.y = 0.82;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), headMat);
    head.position.y = 1.64;
    head.castShadow = true;
    group.add(head);

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.055), coreMat);
    core.position.set(0, 1.02, -0.49);
    group.add(core);

    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 0.7),
      new THREE.MeshStandardMaterial({ color: "#1d2026", metalness: 0.9, roughness: 0.26 }),
    );
    gun.position.set(0.22, 1.06, -0.58);
    group.add(gun);

    const light = new THREE.PointLight("#ff2f62", 1.4, 5, 2);
    light.position.set(0, 1.42, 0);
    group.add(light);

    group.position.set(enemy.position.x, 0, enemy.position.z);
    group.rotation.y = enemy.yaw;
    return { group, body, head, core, light };
  }

  private clearEnemies() {
    for (const view of this.enemyViews.values()) {
      this.scene.remove(view.group);
      disposeObject(view.group);
    }
    this.enemyViews.clear();
  }

  private clearLevel() {
    disposeObject(this.levelGroup);
    this.levelGroup.clear();
  }

  private clearLights() {
    disposeObject(this.lightGroup);
    this.lightGroup.clear();
  }

  private clearPreloadedLevel() {
    if (!this.preloadedLevel) return;
    this.scene.remove(this.preloadedLevel.levelGroup, this.preloadedLevel.lightGroup);
    disposeObject(this.preloadedLevel.levelGroup);
    disposeObject(this.preloadedLevel.lightGroup);
    this.preloadedLevel = undefined;
  }

  private activatePreloadedLevel(levelIndex: number) {
    if (!this.preloadedLevel || this.preloadedLevel.levelIndex !== levelIndex) return false;
    this.clearLevel();
    this.clearLights();
    const { levelGroup, lightGroup } = this.preloadedLevel;
    this.scene.remove(levelGroup, lightGroup);

    while (levelGroup.children.length > 0) {
      const child = levelGroup.children[0];
      this.levelGroup.add(child);
    }
    while (lightGroup.children.length > 0) {
      const child = lightGroup.children[0];
      this.lightGroup.add(child);
    }

    this.preloadedLevel = undefined;
    return true;
  }

  private syncCamera(state: GameState, dt: number) {
    const player = state.player;
    const moving = player.grounded ? player.moveAmount : 0;
    const targetEyeHeight = player.crouching ? 1.06 : 1.62;
    this.cameraEyeHeight = THREE.MathUtils.damp(this.cameraEyeHeight, targetEyeHeight, 14, dt);
    this.bobPhase += dt * (moving > 0 ? 10.5 + moving * 3.5 : 3);
    const bob = Math.sin(this.bobPhase) * 0.035 * moving * (player.crouching ? 0.55 : 1);
    const sway = Math.cos(this.bobPhase * 0.5) * 0.025 * moving;
    const shake = player.shake;
    const jitterX = (Math.random() - 0.5) * 0.045 * shake;
    const jitterY = (Math.random() - 0.5) * 0.035 * shake;

    this.camera.position.set(
      player.position.x + jitterX,
      player.position.y + this.cameraEyeHeight + bob + jitterY,
      player.position.z,
    );
    this.camera.rotation.y = player.yaw + sway * 0.025;
    this.camera.rotation.x = player.pitch + player.recoil * 0.026;
    this.camera.rotation.z = -sway * 0.035;

    this.weapon.position.copy(this.baseWeaponPosition);
    this.weapon.position.y -= player.recoil * 0.055;
    this.weapon.position.z += player.recoil * 0.04;
    this.weapon.rotation.x = -player.recoil * 0.055 + Math.sin(this.bobPhase) * moving * 0.012;
    this.weapon.rotation.y = Math.cos(this.bobPhase * 0.6) * moving * 0.01;
  }

  private syncEnemies(enemies: EnemyStateData[]) {
    for (const enemy of enemies) {
      const view = this.enemyViews.get(enemy.id);
      if (!view) continue;
      const isDead = enemy.state === "dead";
      view.group.visible = true;
      view.group.position.set(enemy.position.x, isDead ? 0.05 : 0, enemy.position.z);
      view.group.rotation.y = enemy.yaw;
      view.group.rotation.z = isDead ? Math.min(1, 1 - enemy.deathTimer / 1.4) * 1.34 : 0;
      const flash = enemy.hitFlash > 0 ? 1 : 0;
      view.body.material.emissive.set(flash ? "#ffea8a" : "#2a0010");
      view.body.material.emissiveIntensity = flash ? 1.5 : 0.35;
      view.head.material.emissive.set(flash ? "#ffffff" : "#ff174f");
      view.head.material.emissiveIntensity = flash ? 1.9 : isDead ? 0.08 : 0.65;
      view.core.material.emissiveIntensity = isDead ? 0.08 : 1.2 + Math.sin(performance.now() * 0.006) * 0.25;
      view.light.intensity = isDead ? 0 : 1.4 + Math.sin(performance.now() * 0.008) * 0.35;
    }
  }

  private updateEffects(dt: number) {
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    const muzzleRatio = Math.min(1, this.muzzleTimer / 0.07);
    this.muzzleLight.intensity = 18 * muzzleRatio;
    this.muzzleFlare.material.opacity = muzzleRatio;
    this.muzzleFlare.scale.setScalar(0.8 + muzzleRatio * 2.2);

    for (let i = this.timedObjects.length - 1; i >= 0; i -= 1) {
      const item = this.timedObjects[i];
      item.life -= dt;
      const ratio = Math.max(0, item.life / item.maxLife);
      item.update?.(ratio, dt);
      if (item.life <= 0) {
        this.scene.remove(item.object);
        disposeObject(item.object);
        this.timedObjects.splice(i, 1);
      }
    }
  }

  private spawnTracer(origin: Vec3, end: Vec3) {
    const material = new THREE.LineBasicMaterial({
      color: "#fff2a6",
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([vecToThree(origin), vecToThree(end)]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.timedObjects.push({
      object: line,
      life: 0.055,
      maxLife: 0.055,
      update: (ratio) => {
        material.opacity = 0.85 * ratio;
      },
    });
  }

  private spawnEnemyBeam(from: Vec3, to: Vec3) {
    const start = new THREE.Vector3(from.x, 1.15, from.z);
    const end = vecToThree(to);
    const material = this.enemyBeamMaterial.clone();
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.timedObjects.push({
      object: line,
      life: 0.08,
      maxLife: 0.08,
      update: (ratio) => {
        material.opacity = 0.85 * ratio;
      },
    });
  }

  private spawnSparks(position: Vec3, color: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.035, 8, 6), material);
      mesh.position.copy(vecToThree(position));
      this.scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1.3,
        (Math.random() - 0.5) * 4,
      );
      this.timedObjects.push({
        object: mesh,
        life: 0.34 + Math.random() * 0.18,
        maxLife: 0.5,
        update: (ratio, dt) => {
          velocity.y -= 8.1 * dt;
          mesh.position.addScaledVector(velocity, dt);
          mesh.scale.setScalar(0.5 + ratio);
          material.opacity = ratio;
        },
      });
    }
  }

  private spawnBurst(position: Vec3) {
    const light = new THREE.PointLight("#ffb45d", 9, 8, 2);
    light.position.set(position.x, 1.2, position.z);
    this.scene.add(light);
    this.timedObjects.push({
      object: light,
      life: 0.32,
      maxLife: 0.32,
      update: (ratio) => {
        light.intensity = 9 * ratio;
      },
    });
    this.spawnSparks({ x: position.x, y: 1.15, z: position.z }, "#ffd76e", 22);
  }

  private clearTimedObjects() {
    for (const item of this.timedObjects) {
      this.scene.remove(item.object);
      disposeObject(item.object);
    }
    this.timedObjects.length = 0;
  }

  private bindBrowserEvents() {
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      document.body.classList.add("context-lost");
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      document.body.classList.remove("context-lost");
    });
  }

  private onResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}

const createFloorTexture = (theme: LevelTheme) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme.floorColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i <= 512; i += 64) {
    ctx.strokeStyle = i % 128 === 0 ? "rgba(58, 84, 102, 0.28)" : "rgba(255,255,255,0.58)";
    ctx.lineWidth = i % 128 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  ctx.fillStyle = `${theme.accentColor}33`;
  ctx.fillRect(248, 0, 16, 512);
  ctx.fillStyle = `${theme.secondaryAccent}2a`;
  ctx.fillRect(0, 248, 512, 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 8;
  return texture;
};

const createLabelTexture = (text: string, theme: LevelTheme) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = theme.signageColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.accentColor;
  ctx.fillRect(0, 0, 18, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(18, 0, canvas.width - 18, 12);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), canvas.width / 2 + 8, canvas.height / 2, canvas.width - 72);
  ctx.fillStyle = theme.secondaryAccent;
  ctx.fillRect(canvas.width - 58, 45, 28, 10);
  ctx.fillRect(canvas.width - 40, 35, 10, 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};
