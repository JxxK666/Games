import type { ColliderKind, LevelData, LevelTheme, PublicSceneType, RectCollider, Vec3 } from "./types";

type SceneBlueprint = {
  type: PublicSceneType;
  name: string;
  objectiveLabel: string;
  floorColor: string;
  wallColor: string;
  accentColor: string;
  secondaryAccent: string;
  signageColor: string;
  signPool: string[];
  counterLabel: string;
  kioskLabel: string;
  adLabel: string;
};

type LayoutBuilder = (blueprint: SceneBlueprint, colliders: RectCollider[]) => string;

const blueprints: SceneBlueprint[] = [
  {
    type: "metro",
    name: "Metro Transfer Hall",
    objectiveLabel: "Secure the metro concourse",
    floorColor: "#d7dde3",
    wallColor: "#ecf2f5",
    accentColor: "#16a3c7",
    secondaryAccent: "#f5c542",
    signageColor: "#16324a",
    signPool: ["Line 2", "Exit A", "Transfer", "Tickets", "Restrooms"],
    counterLabel: "Service Center",
    kioskLabel: "Ticket Kiosk",
    adLabel: "City Transit",
  },
  {
    type: "airport",
    name: "Airport Gate Lounge",
    objectiveLabel: "Secure the gate lounge",
    floorColor: "#dfe7ee",
    wallColor: "#f4f7fa",
    accentColor: "#3178d4",
    secondaryAccent: "#9cc6ff",
    signageColor: "#1d3c66",
    signPool: ["GATE 12", "Security", "Baggage", "Departures", "Info"],
    counterLabel: "Gate Desk",
    kioskLabel: "Check-in Kiosk",
    adLabel: "Flight Board",
  },
  {
    type: "mall",
    name: "Mall Atrium",
    objectiveLabel: "Secure the mall atrium",
    floorColor: "#ece7dc",
    wallColor: "#fff8ef",
    accentColor: "#e05b72",
    secondaryAccent: "#43a971",
    signageColor: "#6b3042",
    signPool: ["Food Court", "Escalator", "Concierge", "Shops", "Exit"],
    counterLabel: "Concierge",
    kioskLabel: "Mall Guide",
    adLabel: "New Arrival",
  },
  {
    type: "hospital",
    name: "Hospital Lobby",
    objectiveLabel: "Secure the hospital lobby",
    floorColor: "#dfeeea",
    wallColor: "#f2fbf8",
    accentColor: "#2db69f",
    secondaryAccent: "#7dd9c8",
    signageColor: "#1f6f67",
    signPool: ["Reception", "Pharmacy", "ER", "Elevators", "Waiting"],
    counterLabel: "Triage Desk",
    kioskLabel: "Registration",
    adLabel: "Health Notice",
  },
  {
    type: "library",
    name: "Public Library Hall",
    objectiveLabel: "Secure the library hall",
    floorColor: "#e7dfd2",
    wallColor: "#f8f3ea",
    accentColor: "#8b6b3f",
    secondaryAccent: "#3d82b8",
    signageColor: "#4b3b2a",
    signPool: ["Borrow Desk", "Reading", "Children", "Elevators", "Exit"],
    counterLabel: "Information",
    kioskLabel: "Self Checkout",
    adLabel: "New Books",
  },
  {
    type: "office",
    name: "Open Plan Office",
    objectiveLabel: "Secure the office floor",
    floorColor: "#cfd3d6",
    wallColor: "#f1f3f4",
    accentColor: "#7aa9a5",
    secondaryAccent: "#b88a5d",
    signageColor: "#35454d",
    signPool: ["Reception", "Meeting Rooms", "Operations", "Break Area", "Exit"],
    counterLabel: "Reception",
    kioskLabel: "Print Station",
    adLabel: "Team Board",
  },
];

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const distanceXZ = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

const makeCollider = (
  kind: ColliderKind,
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  label?: string,
): RectCollider => ({ id, x, z, width, depth, height, kind, label });

const wall = (id: string, x: number, z: number, width: number, depth: number, height = 4.6, label?: string) =>
  makeCollider("wall", id, x, z, width, depth, height, label);

const glassWall = (id: string, x: number, z: number, width: number, depth: number, height = 3.2, label?: string) =>
  makeCollider("glassWall", id, x, z, width, depth, height, label);

const cover = (id: string, x: number, z: number, width: number, depth: number, height = 1.25, label?: string) =>
  makeCollider("cover", id, x, z, width, depth, height, label);

const prop = (
  kind: Exclude<ColliderKind, "wall" | "glassWall" | "cover">,
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  label?: string,
) => makeCollider(kind, id, x, z, width, depth, height, label);

const createTheme = (blueprint: SceneBlueprint): LevelTheme => ({
  type: blueprint.type,
  name: blueprint.name,
  objectiveLabel: blueprint.objectiveLabel,
  floorColor: blueprint.floorColor,
  wallColor: blueprint.wallColor,
  accentColor: blueprint.accentColor,
  secondaryAccent: blueprint.secondaryAccent,
  signageColor: blueprint.signageColor,
});

const addRoomShell = (colliders: RectCollider[]) => {
  colliders.push(
    wall("north-wall", 0, -22, 46, 1.2),
    wall("south-wall", 0, 22, 46, 1.2),
    wall("west-wall", -22, 0, 1.2, 46),
    wall("east-wall", 22, 0, 1.2, 46),
    prop("pillar", "pillar-nw", -16, -15, 1.55, 1.55, 4.8),
    prop("pillar", "pillar-ne", 16, -15, 1.55, 1.55, 4.8),
    prop("pillar", "pillar-sw", -16, 15, 1.55, 1.55, 4.8),
    prop("pillar", "pillar-se", 16, 15, 1.55, 1.55, 4.8),
  );
};

const addCommonWayfinding = (blueprint: SceneBlueprint, colliders: RectCollider[]) => {
  colliders.push(
    prop("adScreen", "ad-screen-left", -20.6, -3.2, 0.24, 4.2, 2.65, blueprint.adLabel),
    prop("adScreen", "ad-screen-right", 20.6, -3.2, 0.24, 4.2, 2.65, blueprint.adLabel),
    prop("sign", "entry-sign", 0, 21.15, 5.8, 0.2, 2.25, blueprint.name),
    prop("sign", "main-wayfinding", 0, -13.7, 5.6, 0.22, 2.8, pick(blueprint.signPool)),
    prop("planter", "planter-a", -17.4, 6.8, 1.35, 1.35, 1.05, "Plant"),
    prop("planter", "planter-b", 17.4, 6.8, 1.35, 1.35, 1.05, "Plant"),
  );
};

const buildMetro: LayoutBuilder = (blueprint, colliders) => {
  colliders.push(
    wall("ticket-office-back", 0, -15.8, 14.2, 1.0, 3.1, "Tickets"),
    glassWall("platform-glass-left", -18.2, -12.4, 0.35, 13.5, 3.1, "Platform Doors"),
    glassWall("platform-glass-right", 18.2, -12.4, 0.35, 13.5, 3.1, "Platform Doors"),
    cover("fare-gates-left", -5.4, 2.4, 8.4, 0.9, 1.12, "Fare Gates"),
    cover("fare-gates-right", 5.4, 2.4, 8.4, 0.9, 1.12, "Fare Gates"),
    prop("kiosk", "ticket-kiosk-a", -12.5, 12.8, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("kiosk", "ticket-kiosk-b", 12.5, 12.8, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("bench", "metro-bench-left", -10.8, -4.8, 4.7, 0.9, 0.75, "Seating"),
    prop("bench", "metro-bench-right", 10.8, -4.8, 4.7, 0.9, 0.75, "Seating"),
    prop("sign", "metro-line-sign", 0, -18.5, 7, 0.22, 2.45, "Line 2"),
    prop("vending", "ticket-machine-left", -16.3, 5.8, 1.25, 0.9, 2.15, "Tickets"),
    prop("vending", "ticket-machine-right", 16.3, 5.8, 1.25, 0.9, 2.15, "Tickets"),
    prop("shelf", "news-stand", -14.5, -0.2, 2.4, 0.75, 1.45, "News"),
    prop("trash", "metro-trash-a", -7.6, 9.4, 0.75, 0.75, 1.05, "Bin"),
    prop("trash", "metro-trash-b", 7.6, 9.4, 0.75, 0.75, 1.05, "Bin"),
    prop("divider", "metro-map-divider-left", -3.4, 8.0, 0.46, 4.8, 1.15, "Map Rail"),
    prop("divider", "metro-map-divider-right", 3.4, 8.0, 0.46, 4.8, 1.15, "Map Rail"),
    prop("lowWall", "metro-platform-cover", 0, -7.2, 7.6, 0.8, 1.2, "Platform Cover"),
    prop("bench", "metro-island-seat-left", -11.2, 3.4, 4.6, 1.0, 0.75, "Platform Seating"),
    prop("bench", "metro-island-seat-right", 11.2, 3.4, 4.6, 1.0, 0.75, "Platform Seating"),
    prop("kiosk", "metro-info-pillar-left", -8.0, -9.2, 1.25, 1.05, 2.05, "Route Map"),
    prop("kiosk", "metro-info-pillar-right", 8.0, -9.2, 1.25, 1.05, 2.05, "Route Map"),
    prop("planter", "metro-planter-left", -14.8, 10.2, 1.4, 1.4, 1.05, "Plant"),
    prop("planter", "metro-planter-right", 14.8, 10.2, 1.4, 1.4, 1.05, "Plant"),
  );
  return "fare gates and platform doors";
};

const buildAirport: LayoutBuilder = (blueprint, colliders) => {
  colliders.push(
    glassWall("runway-window", 0, -21.35, 23, 0.3, 3.4, "Runway Windows"),
    prop("counter", "gate-counter", 0, -10.8, 7.8, 1.2, 1.2, blueprint.counterLabel),
    cover("queue-rail-left", -5.4, -3.2, 0.75, 9.8, 1.0, "Queue Rail"),
    cover("queue-rail-right", 5.4, -3.2, 0.75, 9.8, 1.0, "Queue Rail"),
    prop("bench", "airport-seat-row-a", -10.5, 7.5, 6.2, 1.0, 0.75, "Seating"),
    prop("bench", "airport-seat-row-b", 10.5, 7.5, 6.2, 1.0, 0.75, "Seating"),
    prop("bench", "airport-seat-row-c", -10.5, 12.0, 6.2, 1.0, 0.75, "Seating"),
    prop("bench", "airport-seat-row-d", 10.5, 12.0, 6.2, 1.0, 0.75, "Seating"),
    prop("kiosk", "checkin-kiosk-left", -16, 1.0, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("kiosk", "checkin-kiosk-right", 16, 1.0, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("sign", "gate-screen", 0, -14.8, 5.3, 0.22, 2.35, "GATE 12"),
    prop("shelf", "baggage-rack-left", -14.7, -5.0, 3.2, 0.85, 1.35, "Bags"),
    prop("shelf", "baggage-rack-right", 14.7, -5.0, 3.2, 0.85, 1.35, "Bags"),
    prop("vending", "airport-coffee", -18.2, 7.6, 1.25, 1.0, 2.2, "Coffee"),
    prop("trash", "airport-bin-a", -5.7, 12.3, 0.75, 0.75, 1.05, "Bin"),
    prop("trash", "airport-bin-b", 5.7, 12.3, 0.75, 0.75, 1.05, "Bin"),
    prop("table", "airport-luggage-table-a", -4.0, 6.0, 3.0, 1.45, 0.95, "Luggage"),
    prop("table", "airport-luggage-table-b", 4.0, 6.0, 3.0, 1.45, 0.95, "Luggage"),
    prop("divider", "airport-queue-cross", 0, -3.2, 8.2, 0.42, 1.02, "Queue Belt"),
    prop("lowWall", "gate-partition-left", -9.5, -11.8, 4.6, 0.7, 1.18, "Gate Partition"),
    prop("lowWall", "gate-partition-right", 9.5, -11.8, 4.6, 0.7, 1.18, "Gate Partition"),
    prop("bench", "airport-seat-island-left", -11.0, 1.8, 5.8, 1.0, 0.75, "Gate Seating"),
    prop("bench", "airport-seat-island-right", 11.0, 1.8, 5.8, 1.0, 0.75, "Gate Seating"),
    prop("table", "airport-charge-table-left", -12.8, -8.2, 3.0, 1.35, 0.92, "Charging Table"),
    prop("table", "airport-charge-table-right", 12.8, -8.2, 3.0, 1.35, 0.92, "Charging Table"),
    prop("divider", "airport-queue-return-left", -2.8, -5.7, 0.42, 4.2, 1.02, "Queue Belt"),
    prop("divider", "airport-queue-return-right", 2.8, -5.7, 0.42, 4.2, 1.02, "Queue Belt"),
  );
  return "gate desk with queue lanes";
};

const buildMall: LayoutBuilder = (blueprint, colliders) => {
  colliders.push(
    glassWall("storefront-left", -21.35, -7, 0.3, 13.5, 3.1, "Storefront"),
    glassWall("storefront-right", 21.35, -7, 0.3, 13.5, 3.1, "Storefront"),
    cover("atrium-railing-front", 0, -2.6, 13.8, 0.75, 1.08, "Atrium Rail"),
    cover("atrium-railing-left", -7.0, -5.2, 0.75, 5.8, 1.08, "Atrium Rail"),
    cover("atrium-railing-right", 7.0, -5.2, 0.75, 5.8, 1.08, "Atrium Rail"),
    prop("counter", "concierge", 0, 15.2, 7.5, 1.25, 1.2, blueprint.counterLabel),
    prop("kiosk", "mall-guide-left", -13.2, 9.4, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("kiosk", "mall-guide-right", 13.2, 9.4, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("planter", "mall-planter-a", -4.5, 4.8, 1.6, 1.6, 1.0, "Plant"),
    prop("planter", "mall-planter-b", 4.5, 4.8, 1.6, 1.6, 1.0, "Plant"),
    prop("bench", "mall-bench-left", -11.8, -0.5, 4.8, 1.0, 0.75, "Seating"),
    prop("bench", "mall-bench-right", 11.8, -0.5, 4.8, 1.0, 0.75, "Seating"),
    prop("stall", "mall-pop-up-stall-a", -7.7, 8.4, 3.2, 2.0, 1.85, "Snacks"),
    prop("stall", "mall-pop-up-stall-b", 7.7, 8.4, 3.2, 2.0, 1.85, "Gifts"),
    prop("table", "mall-cafe-table-a", -15.2, 5.2, 1.8, 1.8, 0.9, "Cafe"),
    prop("table", "mall-cafe-table-b", -15.2, 9.0, 1.8, 1.8, 0.9, "Cafe"),
    prop("shelf", "mall-display-left", -16.8, -6.5, 2.5, 0.85, 1.55, "Display"),
    prop("shelf", "mall-display-right", 16.8, -6.5, 2.5, 0.85, 1.55, "Display"),
    prop("vending", "mall-drink-vending", 18.3, 5.0, 1.25, 1.0, 2.15, "Drinks"),
    prop("trash", "mall-bin-a", -6.2, 12.8, 0.75, 0.75, 1.05, "Bin"),
    prop("trash", "mall-bin-b", 6.2, 12.8, 0.75, 0.75, 1.05, "Bin"),
    prop("sculpture", "atrium-sculpture", 0, 1.5, 2.2, 2.2, 1.85, "Art"),
    prop("bench", "mall-planter-seat-left", -5.2, -9.0, 4.2, 1.0, 0.75, "Lounge Seating"),
    prop("bench", "mall-planter-seat-right", 5.2, -9.0, 4.2, 1.0, 0.75, "Lounge Seating"),
    prop("planter", "mall-tree-left", -9.0, -9.0, 1.6, 1.6, 1.05, "Indoor Tree"),
    prop("planter", "mall-tree-right", 9.0, -9.0, 1.6, 1.6, 1.05, "Indoor Tree"),
    prop("stall", "mall-center-display-left", -10.5, 13.0, 3.0, 1.8, 1.75, "Accessories"),
    prop("stall", "mall-center-display-right", 10.5, 13.0, 3.0, 1.8, 1.75, "Desserts"),
  );
  return "atrium railing and storefronts";
};

const buildHospital: LayoutBuilder = (blueprint, colliders) => {
  colliders.push(
    prop("counter", "triage-desk", 0, -11.2, 9.2, 1.3, 1.25, blueprint.counterLabel),
    cover("triage-rail-left", -5.9, -3.6, 0.75, 9.4, 1.05, "Triage Rail"),
    cover("triage-rail-right", 5.9, -3.6, 0.75, 9.4, 1.05, "Triage Rail"),
    wall("clinic-room-left", -14.6, -14.8, 5.8, 1.0, 3.1, "Clinic"),
    wall("clinic-room-right", 14.6, -14.8, 5.8, 1.0, 3.1, "Clinic"),
    prop("bench", "waiting-row-left-a", -11.0, 6.4, 5.6, 1.0, 0.75, "Waiting"),
    prop("bench", "waiting-row-right-a", 11.0, 6.4, 5.6, 1.0, 0.75, "Waiting"),
    prop("bench", "waiting-row-left-b", -11.0, 11.4, 5.6, 1.0, 0.75, "Waiting"),
    prop("bench", "waiting-row-right-b", 11.0, 11.4, 5.6, 1.0, 0.75, "Waiting"),
    prop("kiosk", "registration-a", -16.2, 1.6, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("kiosk", "registration-b", 16.2, 1.6, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("sign", "pharmacy-sign", -15.8, -18.0, 4.8, 0.22, 2.35, "Pharmacy"),
    prop("sign", "emergency-sign", 15.8, -18.0, 4.8, 0.22, 2.35, "Emergency"),
    prop("divider", "privacy-screen-left", -3.6, 6.8, 0.45, 4.8, 1.55, "Privacy"),
    prop("divider", "privacy-screen-right", 3.6, 6.8, 0.45, 4.8, 1.55, "Privacy"),
    prop("shelf", "medical-supply-left", -18.0, -5.2, 2.4, 0.8, 1.5, "Supplies"),
    prop("shelf", "medical-supply-right", 18.0, -5.2, 2.4, 0.8, 1.5, "Supplies"),
    prop("vending", "hospital-water", -18.3, 9.0, 1.25, 1.0, 2.15, "Water"),
    prop("trash", "bio-bin-a", -6.5, 12.8, 0.75, 0.75, 1.05, "Bin"),
    prop("trash", "bio-bin-b", 6.5, 12.8, 0.75, 0.75, 1.05, "Bin"),
    prop("lowWall", "waiting-partition", 0, 10.0, 8.2, 0.65, 1.08, "Waiting"),
    prop("table", "wheelchair-bay", -15.6, 13.8, 2.6, 1.3, 0.88, "Assist"),
    prop("chair", "hospital-chair-row", 15.4, 13.8, 3.2, 1.05, 0.86, "Chairs"),
    prop("counter", "nurse-station-island", 0, 1.6, 5.8, 1.45, 1.18, "Nurse Station"),
    prop("divider", "exam-screen-left-a", -10.2, -5.0, 0.44, 4.2, 1.55, "Privacy Screen"),
    prop("divider", "exam-screen-right-a", 10.2, -5.0, 0.44, 4.2, 1.55, "Privacy Screen"),
    prop("table", "hospital-cart-left", -12.6, 1.8, 2.3, 1.15, 0.9, "Medical Cart"),
    prop("table", "hospital-cart-right", 12.6, 1.8, 2.3, 1.15, 0.9, "Medical Cart"),
    prop("planter", "hospital-calm-plant-left", -7.4, 13.4, 1.3, 1.3, 1.0, "Plant"),
    prop("planter", "hospital-calm-plant-right", 7.4, 13.4, 1.3, 1.3, 1.0, "Plant"),
  );
  return "reception desk and waiting rows";
};

const buildLibrary: LayoutBuilder = (blueprint, colliders) => {
  colliders.push(
    prop("counter", "borrow-desk", 0, 15.4, 7.6, 1.25, 1.25, blueprint.counterLabel),
    prop("shelf", "bookshelf-left-a", -15.4, -9.5, 2.0, 8.8, 2.25, "Bookshelf"),
    prop("shelf", "bookshelf-left-b", -10.8, -9.5, 2.0, 8.8, 2.25, "Bookshelf"),
    prop("shelf", "bookshelf-right-a", 15.4, -9.5, 2.0, 8.8, 2.25, "Bookshelf"),
    prop("shelf", "bookshelf-right-b", 10.8, -9.5, 2.0, 8.8, 2.25, "Bookshelf"),
    cover("reading-table-a", -5.2, 2.4, 5.2, 1.6, 1.0, "Reading Table"),
    cover("reading-table-b", 5.2, 2.4, 5.2, 1.6, 1.0, "Reading Table"),
    prop("kiosk", "checkout-left", -15.5, 9.5, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("kiosk", "checkout-right", 15.5, 9.5, 1.35, 1.1, 2.05, blueprint.kioskLabel),
    prop("sign", "new-books-sign", 0, -17.8, 5.4, 0.22, 2.35, blueprint.adLabel),
    prop("shelf", "magazine-rack-left", -17.5, 1.4, 2.4, 0.8, 1.45, "Magazines"),
    prop("shelf", "magazine-rack-right", 17.5, 1.4, 2.4, 0.8, 1.45, "Magazines"),
    prop("table", "study-table-left", -7.6, 9.0, 3.8, 1.7, 0.92, "Study"),
    prop("table", "study-table-right", 7.6, 9.0, 3.8, 1.7, 0.92, "Study"),
    prop("chair", "study-chairs-left", -7.6, 11.0, 3.4, 0.82, 0.82, "Chairs"),
    prop("chair", "study-chairs-right", 7.6, 11.0, 3.4, 0.82, 0.82, "Chairs"),
    prop("divider", "quiet-divider-left", -3.3, -5.6, 0.45, 6.8, 1.45, "Quiet"),
    prop("divider", "quiet-divider-right", 3.3, -5.6, 0.45, 6.8, 1.45, "Quiet"),
    prop("trash", "library-bin-a", -4.0, 14.2, 0.75, 0.75, 1.05, "Bin"),
    prop("trash", "library-bin-b", 4.0, 14.2, 0.75, 0.75, 1.05, "Bin"),
    prop("shelf", "bookshelf-center-left", -5.8, -10.0, 1.8, 8.2, 2.15, "Bookshelf"),
    prop("shelf", "bookshelf-center-right", 5.8, -10.0, 1.8, 8.2, 2.15, "Bookshelf"),
    prop("table", "library-reading-island-left", -12.8, 3.6, 3.6, 1.55, 0.92, "Reading Table"),
    prop("table", "library-reading-island-right", 12.8, 3.6, 3.6, 1.55, 0.92, "Reading Table"),
    prop("planter", "library-planter-left", -3.0, 12.6, 1.25, 1.25, 1.0, "Plant"),
    prop("planter", "library-planter-right", 3.0, 12.6, 1.25, 1.25, 1.0, "Plant"),
  );
  return "bookshelf aisles and reading tables";
};

const buildOffice: LayoutBuilder = (blueprint, colliders) => {
  const workstationPods = [
    { id: "north-left", x: -9.2, z: -6.8 },
    { id: "north-right", x: 9.2, z: -6.8 },
    { id: "south-left", x: -9.2, z: 4.2 },
    { id: "south-right", x: 9.2, z: 4.2 },
  ];

  colliders.push(
    glassWall("office-meeting-room-left", -15.6, -15.5, 8.8, 0.32, 3.15, "Meeting Room"),
    glassWall("office-meeting-room-right", 15.6, -15.5, 8.8, 0.32, 3.15, "Meeting Room"),
    prop("counter", "office-reception", 0, -16.0, 7.2, 1.3, 1.18, blueprint.counterLabel),
    prop("kiosk", "office-printer-left", -17.2, 10.0, 1.5, 1.1, 1.75, blueprint.kioskLabel),
    prop("kiosk", "office-printer-right", 17.2, 10.0, 1.5, 1.1, 1.75, blueprint.kioskLabel),
    prop("shelf", "office-file-wall-left", -18.2, -5.0, 1.1, 7.0, 1.75, "Files"),
    prop("shelf", "office-file-wall-right", 18.2, -5.0, 1.1, 7.0, 1.75, "Files"),
    prop("shelf", "office-resource-cabinet-left", -15.8, 14.0, 3.5, 0.95, 1.45, "Storage"),
    prop("shelf", "office-resource-cabinet-right", 15.8, 14.0, 3.5, 0.95, 1.45, "Storage"),
    prop("table", "office-copy-island", 0, -1.2, 3.4, 2.0, 0.9, "Copy Station"),
    prop("divider", "office-center-screen", 0, 6.2, 0.46, 6.0, 1.48, "Acoustic Screen"),
    prop("planter", "office-center-plant-a", -3.1, 7.8, 1.35, 1.35, 1.05, "Plant"),
    prop("planter", "office-center-plant-b", 3.1, 7.8, 1.35, 1.35, 1.05, "Plant"),
  );

  for (const pod of workstationPods) {
    colliders.push(
      prop("table", `office-workstation-${pod.id}`, pod.x, pod.z, 6.0, 2.0, 0.84, "Workstation"),
      prop("divider", `office-panel-${pod.id}`, pod.x, pod.z, 6.2, 0.24, 1.48, "Cubicle Panel"),
      prop("chair", `office-chair-${pod.id}`, pod.x, pod.z + 2.0, 2.8, 0.9, 0.84, "Office Chairs"),
      prop("planter", `office-plant-${pod.id}`, pod.x + (pod.x < 0 ? -3.8 : 3.8), pod.z, 1.2, 1.2, 1.0, "Plant"),
    );
  }

  return "cubicle pods, file cabinets and meeting rooms";
};

const layoutBuilders: Record<PublicSceneType, LayoutBuilder> = {
  metro: buildMetro,
  airport: buildAirport,
  mall: buildMall,
  hospital: buildHospital,
  library: buildLibrary,
  office: buildOffice,
};

const collidesWithRect = (point: Vec3, collider: RectCollider, radius: number) => {
  const minX = collider.x - collider.width / 2 - radius;
  const maxX = collider.x + collider.width / 2 + radius;
  const minZ = collider.z - collider.depth / 2 - radius;
  const maxZ = collider.z + collider.depth / 2 + radius;
  return point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ;
};

const isClear = (point: Vec3, colliders: RectCollider[], radius = 0.95) =>
  Math.abs(point.x) < 20.2 &&
  point.z > -20.2 &&
  point.z < 18.8 &&
  !colliders.some((collider) => collidesWithRect(point, collider, radius));

const findClearNear = (origin: Vec3, colliders: RectCollider[], fallback: Vec3) => {
  for (let i = 0; i < 28; i += 1) {
    const candidate = v(origin.x + rand(-3.2, 3.2), 0, origin.z + rand(-3.2, 3.2));
    if (isClear(candidate, colliders, 0.75)) return candidate;
  }
  return fallback;
};

const isPlacementClear = (
  x: number,
  z: number,
  width: number,
  depth: number,
  colliders: RectCollider[],
  margin = 0.42,
) => {
  if (x - width / 2 < -20.8 || x + width / 2 > 20.8 || z - depth / 2 < -20.8 || z + depth / 2 > 20.2) {
    return false;
  }

  return !colliders.some(
    (collider) =>
      Math.abs(x - collider.x) < (width + collider.width) / 2 + margin &&
      Math.abs(z - collider.z) < (depth + collider.depth) / 2 + margin,
  );
};

const addIfClear = (
  colliders: RectCollider[],
  kind: ColliderKind,
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  label?: string,
) => {
  if (isPlacementClear(x, z, width, depth, colliders)) {
    colliders.push(makeCollider(kind, id, x, z, width, depth, height, label));
  }
};

const addSpawnSafetyCover = (colliders: RectCollider[]) => {
  addIfClear(colliders, "lowWall", "entry-cover-left", -6.2, 15.4, 4.8, 0.72, 1.15, "Entry Cover");
  addIfClear(colliders, "lowWall", "entry-cover-right", 6.2, 15.4, 4.8, 0.72, 1.15, "Entry Cover");
  addIfClear(colliders, "divider", "entry-screen-left", -3.0, 17.4, 0.46, 3.6, 1.35, "Entry Screen");
  addIfClear(colliders, "divider", "entry-screen-right", 3.0, 17.4, 0.46, 3.6, 1.35, "Entry Screen");
  addIfClear(colliders, "planter", "entry-planter-left", -10.4, 16.8, 1.35, 1.35, 1.05, "Plant");
  addIfClear(colliders, "planter", "entry-planter-right", 10.4, 16.8, 1.35, 1.35, 1.05, "Plant");
  addIfClear(colliders, "adScreen", "entry-info-board", -14.8, 15.6, 0.24, 3.6, 2.45, "Map");
  addIfClear(colliders, "vending", "entry-vending", 14.8, 15.6, 1.2, 0.95, 2.1, "Drinks");
};

const addLowPolyDressing = (blueprint: SceneBlueprint, colliders: RectCollider[]) => {
  const detailPool: Array<{
    kind: ColliderKind;
    width: number;
    depth: number;
    height: number;
    label: string;
  }> =
    blueprint.type === "office"
      ? [
          { kind: "table", width: 3.6, depth: 1.6, height: 0.84, label: "Workstation" },
          { kind: "divider", width: 3.8, depth: 0.24, height: 1.45, label: "Cubicle Panel" },
          { kind: "shelf", width: 2.5, depth: 0.9, height: 1.45, label: "Files" },
          { kind: "planter", width: 1.2, depth: 1.2, height: 1.0, label: "Plant" },
        ]
      : blueprint.type === "mall"
      ? [
          { kind: "stall", width: 2.9, depth: 1.8, height: 1.8, label: "Cart" },
          { kind: "table", width: 1.65, depth: 1.65, height: 0.9, label: "Cafe" },
          { kind: "shelf", width: 2.2, depth: 0.82, height: 1.45, label: "Display" },
          { kind: "planter", width: 1.25, depth: 1.25, height: 1.0, label: "Plant" },
        ]
      : blueprint.type === "library"
        ? [
            { kind: "shelf", width: 2.35, depth: 0.82, height: 1.52, label: "Books" },
            { kind: "table", width: 2.6, depth: 1.55, height: 0.9, label: "Study" },
            { kind: "chair", width: 1.65, depth: 0.82, height: 0.8, label: "Chairs" },
            { kind: "divider", width: 0.45, depth: 3.4, height: 1.35, label: "Quiet" },
          ]
        : blueprint.type === "hospital"
          ? [
              { kind: "divider", width: 0.45, depth: 3.6, height: 1.45, label: "Privacy" },
              { kind: "chair", width: 2.2, depth: 0.92, height: 0.82, label: "Waiting" },
              { kind: "shelf", width: 2.2, depth: 0.82, height: 1.42, label: "Supply" },
              { kind: "trash", width: 0.72, depth: 0.72, height: 1.02, label: "Bin" },
            ]
          : blueprint.type === "airport"
            ? [
                { kind: "shelf", width: 2.8, depth: 0.85, height: 1.35, label: "Bags" },
                { kind: "table", width: 2.4, depth: 1.25, height: 0.9, label: "Luggage" },
                { kind: "divider", width: 0.46, depth: 3.4, height: 1.05, label: "Queue" },
                { kind: "trash", width: 0.72, depth: 0.72, height: 1.02, label: "Bin" },
              ]
            : [
                { kind: "vending", width: 1.2, depth: 0.95, height: 2.08, label: "Tickets" },
                { kind: "shelf", width: 2.2, depth: 0.78, height: 1.4, label: "News" },
                { kind: "divider", width: 0.45, depth: 3.6, height: 1.12, label: "Rail" },
                { kind: "trash", width: 0.72, depth: 0.72, height: 1.02, label: "Bin" },
              ];

  const anchorPoints = [
    [-17.2, 11.8],
    [-13.6, 3.7],
    [-9.2, 11.0],
    [-7.0, -2.4],
    [-4.4, -9.4],
    [0, 7.5],
    [4.4, -9.4],
    [7.0, -2.4],
    [9.2, 11.0],
    [13.6, 3.7],
    [17.2, 11.8],
  ];

  for (let i = 0; i < anchorPoints.length; i += 1) {
    const [baseX, baseZ] = anchorPoints[(i + Math.floor(rand(0, anchorPoints.length))) % anchorPoints.length];
    const detail = pick(detailPool);
    const x = baseX + rand(-1.0, 1.0);
    const z = baseZ + rand(-1.0, 1.0);
    if (z > 13.6 && Math.abs(x) < 5.4) continue;
    addIfClear(
      colliders,
      detail.kind,
      `detail-${blueprint.type}-${i}`,
      x,
      z,
      detail.width,
      detail.depth,
      detail.height,
      detail.label,
    );
  }
};

const segmentIntersectsCollider = (from: Vec3, to: Vec3, collider: RectCollider, margin = 0.15) => {
  const minX = collider.x - collider.width / 2 - margin;
  const maxX = collider.x + collider.width / 2 + margin;
  const minZ = collider.z - collider.depth / 2 - margin;
  const maxZ = collider.z + collider.depth / 2 + margin;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 0.00001) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return clip(-dx, from.x - minX) && clip(dx, maxX - from.x) && clip(-dz, from.z - minZ) && clip(dz, maxZ - from.z);
};

const hasCoverBetween = (from: Vec3, to: Vec3, colliders: RectCollider[]) =>
  colliders.some(
    (collider) =>
      collider.height >= 1.05 &&
      collider.kind !== "trash" &&
      collider.kind !== "chair" &&
      segmentIntersectsCollider(from, to, collider),
  );

const createEnemySpawns = (colliders: RectCollider[], playerSpawn: Vec3, levelIndex: number) => {
  const spawns: LevelData["enemySpawns"] = [];
  const enemyCount = Math.min(8, 5 + Math.floor(levelIndex / 2));
  const frontBands = [
    { zMin: 1.5, zMax: 7.2, xMin: -16.5, xMax: 16.5 },
    { zMin: -7.6, zMax: -1.8, xMin: -18, xMax: 18 },
    { zMin: -16.2, zMax: -9.4, xMin: -17, xMax: 17 },
  ];

  for (let i = 0; i < enemyCount; i += 1) {
    let position = findClearNear(v(-12 + (i % 4) * 8, 0, -10.5 - Math.floor(i / 4) * 4), colliders, v(0, 0, -12));
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const band = frontBands[(i + attempt) % frontBands.length];
      const candidate = v(rand(band.xMin, band.xMax), 0, rand(band.zMin, band.zMax));
      const farFromPlayer = distanceXZ(candidate, playerSpawn) > 11.2;
      const farFromEnemies = spawns.every((spawn) => distanceXZ(candidate, spawn.position) > 4.2);
      const blockedFromSpawn = candidate.z < -6.2 || hasCoverBetween(candidate, playerSpawn, colliders);
      if (farFromPlayer && farFromEnemies && blockedFromSpawn && isClear(candidate, colliders)) {
        position = candidate;
        break;
      }
    }

    const patrolA = findClearNear(v(position.x + rand(-4, 4), 0, position.z + rand(-3.5, 3.5)), colliders, position);
    const patrolB = findClearNear(v(position.x + rand(-4, 4), 0, position.z + rand(-3.5, 3.5)), colliders, position);
    spawns.push({
      id: `sentinel-${String(i + 1).padStart(2, "0")}`,
      position,
      patrol: [position, patrolA, patrolB],
    });
  }

  return spawns;
};

export const createLevel = (levelIndex = 1): LevelData => {
  const requestedScene = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("scene");
  const blueprint = blueprints.find((candidate) => candidate.type === requestedScene) ?? pick(blueprints);
  const playerSpawn = v(0, 0, 18.2);
  const colliders: RectCollider[] = [];
  addRoomShell(colliders);
  addCommonWayfinding(blueprint, colliders);
  const layoutName = layoutBuilders[blueprint.type](blueprint, colliders);
  addSpawnSafetyCover(colliders);
  addLowPolyDressing(blueprint, colliders);

  return {
    theme: createTheme(blueprint),
    layoutName,
    playerSpawn,
    colliders,
    enemySpawns: createEnemySpawns(colliders, playerSpawn, levelIndex),
  };
};
