// Catálogo de frentes, batallas y unidades
export const FRONTS = {
  pacific: {
    name: 'Pacífico', years: '1942–1944', vs: 'EE. UU. contra Japón',
    desc: 'Archipiélagos, atolones y mar abierto. La US Navy y sus portaaviones contra la Armada Imperial japonesa.',
    battles: ['naval', 'air', 'combined'], enemyName: 'Japón',
  },
  africa: {
    name: 'Norte de África', years: '1942', vs: 'Commonwealth contra Alemania e Italia',
    desc: 'El desierto occidental: dunas, escarpes y la costa mediterránea. El 8.º Ejército contra el Afrika Korps.',
    battles: ['air', 'land', 'combined'], enemyName: 'Eje',
  },
  europe: {
    name: 'Europa', years: '1944', vs: 'Aliados contra Alemania',
    desc: 'El Canal de la Mancha y Normandía: acantilados, bocage, pueblos y cielos disputados.',
    battles: ['naval', 'air', 'land', 'combined'], enemyName: 'Alemania',
  },
};

export const KIND_NAME = { naval: 'Batalla naval', air: 'Batalla aérea', land: 'Batalla de tanques', combined: 'Batalla combinada' };

export const BATTLES = {
  'pacific-naval': {
    front: 'pacific', kind: 'naval', map: 'pacific_sea', title: 'Islas Salomón', year: '1942',
    brief: 'Controla los tres pasos entre islas (A, B, C). Los destructores japoneses llevan torpedos Long Lance de largo alcance: pon tus cañones de costado y usa los submarinos para emboscar.',
    allies: [['yorktown', 1], ['washington', 1], ['baltimore', 1], ['fletcher', 5], ['gato', 2], ['pt109', 2]],
    enemy: [['akagi', 1], ['kirishima', 1], ['takao', 1], ['kagero', 7], ['i15', 2]],
  },
  'pacific-air': {
    front: 'pacific', kind: 'air', map: 'pacific_air', title: 'Midway', year: '1942',
    brief: 'Destruye las tres instalaciones japonesas del atolón (A, B, C) y protege las tuyas. Tus Dauntless son los bombarderos: escóltalos. El Zero gira mejor que el Wildcat; no te enzarces en giros cerrados.',
    allies: [['wildcat', 6], ['sbd', 4]], enemy: [['zero', 6], ['val', 4]], sites: ['us', 'jp'],
  },
  'pacific-combined': {
    front: 'pacific', kind: 'combined', map: 'atoll', title: 'Tarawa', year: '1943',
    brief: 'Desembarco anfibio en un atolón fortificado. Tus Sherman e infantes de marina llegan a la playa sur bajo el fuego de los búnkeres; la flota los apoya desde el mar y los aviones embarcados cubren el cielo. Toma la cabeza de playa (A) y el aeródromo (B) y controla el fondeadero (C).',
    hint: 'A: cabeza de playa · B: aeródromo · C: fondeadero (naval). Tab cambia entre barco, avión y tanque',
    allies: [['baltimore', 1], ['fletcher', 2], ['wildcat', 2], ['sbd', 2], ['sherman', 3], ['inf_us', 3]],
    enemy: [['kagero', 1], ['i15', 1], ['zero', 2], ['val', 1], ['chiha', 3], ['inf_jp', 3], ['at_jp', 1]],
    statics: [['battery', 3], ['aa', 2]], staticFac: 'jp',
  },
  'africa-air': {
    front: 'africa', kind: 'air', map: 'africa_air', title: 'Desierto occidental', year: '1942',
    brief: 'Ataca los depósitos del Eje (A, B, C) con los Hurricane mientras los Kittyhawk mantienen alejados a los Bf 109 y Macchi. Defiende tus aeródromos de los Stuka.',
    allies: [['p40', 6], ['hurricane', 4]], enemy: [['bf109', 4], ['mc202', 2], ['ju87', 4]], sites: ['uk', 'de'],
  },
  'africa-combined': {
    front: 'africa', kind: 'combined', map: 'tobruk', title: 'Asedio de Tobruk', year: '1941',
    brief: 'Tobruk resiste rodeada. Defiende el perímetro (B) y El Adem (C) con los Matilda y la infantería australiana, y mantén abierto el puerto (A) para que entre el convoy de suministros. Cada mercante que llega da puntos de mando y de batalla; los Stuka y las S-Boot irán a por él.',
    hint: 'A: puerto (naval) · B: perímetro · C: El Adem. Escolta el convoy hasta el puerto',
    allies: [['tribal', 2], ['hurricane', 2], ['p40', 2], ['matilda', 3], ['crusader', 1], ['inf_aus', 3], ['at_uk', 1]],
    enemy: [['sboot', 2], ['u7c', 1], ['bf109', 2], ['ju87', 2], ['pz3', 3], ['pz4f2', 1], ['m13', 2], ['inf_dak', 2], ['pak40', 1]],
    convoy: [['merchant', 2]],
  },
  'africa-land': {
    front: 'africa', kind: 'land', map: 'africa_land', title: 'El Alamein', year: '1942',
    brief: 'Toma y mantén las tres posiciones de la cresta (A, B, C). Los Panzer IV F2 te superan en alcance: flanquéalos, el blindaje lateral y trasero es más débil. Shift lanza una cortina de humo.',
    allies: [['sherman_uk', 4], ['grant', 3], ['crusader', 3], ['inf_uk', 2], ['at_uk', 1]], enemy: [['pz3', 4], ['pz4f2', 4], ['m13', 2], ['inf_dak', 2], ['pak40', 1]],
  },
  'europe-naval': {
    front: 'europe', kind: 'naval', map: 'europe_sea', title: 'Canal de la Mancha', year: '1944',
    brief: 'Asegura las rutas del convoy (A, B, C). Las S-Boot son rápidas y letales de noche y de día: no dejes que lleguen a distancia de torpedo. Cuidado con los U-Boot sumergidos; tus destructores llevan cargas de profundidad (C).',
    allies: [['town', 1], ['tribal', 5], ['tclass', 2], ['mtb', 2]],
    enemy: [['hipper', 1], ['z1936', 4], ['u7c', 2], ['sboot', 3]],
  },
  'europe-air': {
    front: 'europe', kind: 'air', map: 'europe_air', title: 'Sobre el Canal', year: '1944',
    brief: 'Superioridad aérea antes del desembarco: destruye el radar, el aeródromo y el depósito alemanes en la costa francesa (A, B, C). Los P-47 llevan la carga pesada.',
    allies: [['p51', 6], ['p47', 4]], enemy: [['bf109g', 6], ['fw190f', 4]], sites: ['us', 'de'],
  },
  'europe-combined': {
    front: 'europe', kind: 'combined', map: 'normandy', title: 'Día D: playa de Normandía', year: '1944',
    brief: 'Mar, aire y tierra a la vez. Tus tanques desembarcan bajo el fuego de las baterías costeras; los barcos pueden bombardear la costa y los aviones cubren el cielo. Toma la salida de la playa (A) y el pueblo (B) con los tanques y controla el fondeadero (C) con la flota. Tab salta entre barco, avión y tanque; G selecciona por tipo.',
    hint: 'A: salida de la playa · B: pueblo · C: fondeadero (naval). Tab cambia entre barco, avión y tanque',
    allies: [['rodney', 1], ['town', 1], ['fletcher', 2], ['pt109', 1], ['p51', 3], ['p47', 2], ['sherman', 3], ['firefly', 1], ['inf_us', 2]],
    enemy: [['z1936', 1], ['sboot', 2], ['u7c', 1], ['bf109g', 2], ['fw190f', 1], ['pz4h', 2], ['panther', 1], ['stug', 1], ['inf_de', 2], ['pak40', 1]],
    statics: [['battery', 3], ['aa', 2]],
  },
  'test': {
    front: 'europe', kind: 'test', map: 'normandy', title: 'Campo de pruebas', year: '',
    brief: 'Sin puntos ni derrota. Elige cualquier unidad del catálogo, añade blancos o enemigos y prueba armas, blindajes y cámaras.',
    allies: [['sherman', 1]], enemy: [],
  },
  'europe-land': {
    front: 'europe', kind: 'land', map: 'europe_land', title: 'Bocage normando', year: '1944',
    brief: 'Toma los cruces de caminos (A, B, C). Panther y Tiger destrozan a cualquier Sherman de frente: usa a los Firefly y al M10 para el trabajo duro y flanquea entre los setos.',
    allies: [['sherman', 5], ['firefly', 2], ['cromwell', 2], ['m10', 1], ['inf_us', 3], ['at_us', 1]], enemy: [['pz4h', 4], ['panther', 3], ['stug', 2], ['tiger', 1], ['inf_de', 3], ['pak40', 2]],
  },
};

// Plantillas por clase (estadísticas base, unidades del juego ~ metros)
export const CLS = {
  destroyer: { dom: 'sea', hp: 720, max: 36, acc: 9, turn: 0.55, len: 40, beam: 4.6, fb: 2.4, value: 30,
    main: { range: 680, rof: 2.4, dmg: 26, hs: 270, n: 1 }, torp: { n: 4, cd: 30, dmg: 140 }, dc: true, aa: { range: 280, rof: 0.22, dmg: 3 }, ammo: { ap: 45, he: 45, torp: 2, dc: 8 } },
  cruiser: { dom: 'sea', hp: 1700, max: 28, acc: 5, turn: 0.36, len: 64, beam: 7, fb: 3.2, value: 70,
    main: { range: 980, rof: 3.8, dmg: 46, hs: 320, n: 3 }, aa: { range: 330, rof: 0.12, dmg: 3 }, ammo: { ap: 40, he: 40, torp: 2 } },
  pt: { dom: 'sea', hp: 200, max: 52, acc: 22, turn: 1.15, len: 15, beam: 3.6, fb: 1.3, value: 10,
    mg: { range: 300, rof: 0.09, dmg: 3 }, torp: { n: 2, cd: 22, dmg: 150 }, ammo: { torp: 2 } },
  sub: { dom: 'sea', hp: 430, max: 20, acc: 5, turn: 0.62, len: 32, beam: 3.4, fb: 0.9, value: 25,
    torp: { n: 3, cd: 16, dmg: 170 }, deck: { range: 460, rof: 3, dmg: 14, hs: 240 }, sub: true, ammo: { torp: 4, deck: 40 } },
  fighter: { dom: 'air', hp: 140, min: 70, max: 145, acc: 40, turn: 1.6, alt: 95, value: 20, r: 9,
    guns: { range: 340, rof: 0.075, dmg: 1.7 }, bomb: { dmg: 70, rad: 22, cd: 9 }, ammo: { guns: 700, bomb: 1 } },
  bomber: { dom: 'air', hp: 240, min: 60, max: 118, acc: 30, turn: 1.1, alt: 80, value: 25, r: 10,
    guns: { range: 280, rof: 0.12, dmg: 1.3 }, bomb: { dmg: 170, rad: 32, cd: 6 }, rear: true, ammo: { guns: 500, bomb: 3 } },
  tank: { dom: 'land', hp: 260, max: 26, acc: 14, turn: 1.4, value: 25, gun: { range: 470, rof: 3.2, dmg: 55 }, armor: [0.9, 1.2, 1.6], tsp: 1.0, ammo: { ap: 45, he: 30 }, coax: true },
  inf: { dom: 'land', hp: 90, max: 6, acc: 8, turn: 2.5, value: 10, rifle: { range: 280, rof: 0.22, dmg: 1.4 }, rocket: { range: 140, rof: 7, dmg: 80 }, ammo: { rocket: 6 }, soft: true },
  atgun: { dom: 'land', hp: 120, max: 1.6, acc: 3, turn: 0.45, value: 12, gun: { range: 540, rof: 3.4, dmg: 82 }, armor: [0.85, 1.2, 1.5], tsp: 0.7, ammo: { ap: 40, he: 20 }, soft: true },
  site: { dom: 'static', hp: 1000, value: 150 },
  aa: { dom: 'static', hp: 90, value: 4, flak: { range: 420, rof: 1.2, dmg: 15 } },
  battleship: { dom: 'sea', hp: 3200, max: 27, acc: 4, turn: 0.28, len: 100, beam: 13, fb: 4, value: 150, main: { range: 1350, rof: 6, dmg: 85, hs: 360, n: 3 }, aa: { range: 340, rof: 0.08, dmg: 3 }, ammo: { ap: 30, he: 30 } },
  carrier: { dom: 'sea', hp: 2000, max: 30, acc: 4, turn: 0.3, len: 110, beam: 13, fb: 6, value: 120, aa: { range: 340, rof: 0.08, dmg: 3 }, hangar: 6 },
  merchant: { dom: 'sea', hp: 600, max: 18, acc: 4, turn: 0.35, len: 56, beam: 8, fb: 3.5, value: 35, aa: { range: 220, rof: 0.35, dmg: 2 } },
  battery: { dom: 'static', hp: 650, value: 40, main: { range: 950, rof: 5, dmg: 38, hs: 300, n: 1 } },
};

// Modelos concretos: cls, fac, nombre y parámetros visuales
export const MODELS = {
  // ---------- Naval ----------
  fletcher: { cls: 'destroyer', fac: 'us', name: 'USS Fletcher', type: 'Destructor', hull: 0x4b5864, sup: 0x8b949a, deck: 0x4a5056, turrets: [0.36, 0.26, -0.2, -0.3, -0.4], tw: 1, funnels: [0.07, -0.07], tubes: [-0.02, -0.13] },
  kagero: { cls: 'destroyer', fac: 'jp', name: 'IJN Kagero', type: 'Destructor', hull: 0x595f63, sup: 0x6e7478, deck: 0x7a5a3e, turrets: [0.34, -0.26, -0.37], tw: 2, funnels: [0.12, -0.02], tubes: [0.04, -0.13], stats: { torp: { n: 4, cd: 26, dmg: 180 }, main: { range: 640, rof: 2.4, dmg: 24, hs: 270, n: 2 } } },
  tribal: { cls: 'destroyer', fac: 'uk', name: 'HMS Tartar (Tribal)', type: 'Destructor', hull: 0x7f888c, sup: 0xadb4b7, deck: 0x6b6a64, turrets: [0.35, 0.25, -0.27, -0.37], tw: 2, funnels: [0.04], tubes: [-0.07], stats: { main: { range: 660, rof: 2.4, dmg: 22, hs: 270, n: 2 } } },
  z1936: { cls: 'destroyer', fac: 'de', name: 'Z 28 (Zerstörer 1936)', type: 'Destructor', hull: 0x868d91, sup: 0xa4aaad, deck: 0x9a7d5d, turrets: [0.35, 0.26, -0.22, -0.31, -0.4], tw: 1, funnels: [0.1, -0.06], tubes: [0.02, -0.14] },
  baltimore: { cls: 'cruiser', fac: 'us', name: 'USS Baltimore', type: 'Crucero pesado', hull: 0x4b5864, sup: 0x8b949a, deck: 0x4a5056, turrets: [0.33, 0.23, -0.3], tw: 3, funnels: [0.04, -0.1] },
  takao: { cls: 'cruiser', fac: 'jp', name: 'IJN Takao', type: 'Crucero pesado', hull: 0x595f63, sup: 0x6e7478, deck: 0x7a5a3e, turrets: [0.37, 0.29, 0.21, -0.26, -0.35], tw: 2, funnels: [0.0], bigBridge: true, stats: { torp: { n: 4, cd: 30, dmg: 180 }, main: { range: 960, rof: 3.8, dmg: 40, hs: 320, n: 2 } } },
  town: { cls: 'cruiser', fac: 'uk', name: 'HMS Belfast (Town)', type: 'Crucero ligero', hull: 0x7f888c, sup: 0xadb4b7, deck: 0x6b6a64, turrets: [0.33, 0.23, -0.25, -0.34], tw: 3, funnels: [0.05, -0.08], stats: { main: { range: 940, rof: 3.2, dmg: 34, hs: 320, n: 3 } } },
  hipper: { cls: 'cruiser', fac: 'de', name: 'Admiral Hipper', type: 'Crucero pesado', hull: 0x868d91, sup: 0xa4aaad, deck: 0x9a7d5d, turrets: [0.33, 0.24, -0.25, -0.34], tw: 2, funnels: [0.0], bigBridge: true, stats: { torp: { n: 4, cd: 30, dmg: 150 }, main: { range: 980, rof: 3.8, dmg: 46, hs: 320, n: 2 } } },
  washington: { cls: 'battleship', fac: 'us', name: 'USS Washington', type: 'Acorazado', hull: 0x4b5864, sup: 0x8b949a, deck: 0x4a5056, turrets: [0.33, 0.22, -0.3], tw: 3, funnels: [0.0], bigBridge: true },
  iowa: { cls: 'battleship', fac: 'us', name: 'USS Iowa', type: 'Acorazado rápido', hull: 0x4b5864, sup: 0x8b949a, deck: 0x6b5d48, turrets: [0.34, 0.24, -0.31], tw: 3, funnels: [0.04, -0.06], bigBridge: true, stats: { hp: 3500, max: 32, main: { range: 1400, rof: 6, dmg: 92, hs: 380, n: 3 } } },
  kirishima: { cls: 'battleship', fac: 'jp', name: 'IJN Kirishima', type: 'Acorazado (Kongō)', hull: 0x595f63, sup: 0x6e7478, deck: 0x7a5a3e, turrets: [0.35, 0.26, -0.25, -0.35], tw: 2, funnels: [0.06, -0.06], bigBridge: true, stats: { hp: 2600, main: { range: 1250, rof: 5.5, dmg: 70, hs: 350, n: 2 } } },
  yamato: { cls: 'battleship', fac: 'jp', name: 'IJN Yamato', type: 'Acorazado', hull: 0x595f63, sup: 0x6e7478, deck: 0x7a5a3e, turrets: [0.32, 0.22, -0.3], tw: 3, funnels: [-0.02], bigBridge: true, stats: { hp: 4200, max: 26, main: { range: 1500, rof: 7, dmg: 120, hs: 380, n: 3 } } },
  bismarck: { cls: 'battleship', fac: 'de', name: 'Bismarck', type: 'Acorazado', hull: 0x868d91, sup: 0xa4aaad, deck: 0x9a7d5d, turrets: [0.34, 0.25, -0.26, -0.35], tw: 2, funnels: [0.02], bigBridge: true, stats: { hp: 3400, main: { range: 1350, rof: 5.5, dmg: 90, hs: 360, n: 2 } } },
  rodney: { cls: 'battleship', fac: 'uk', name: 'HMS Rodney', type: 'Acorazado (Nelson)', hull: 0x7f888c, sup: 0xadb4b7, deck: 0x6b6a64, turrets: [0.36, 0.27, 0.17], tw: 3, funnels: [-0.14], bigBridge: true, stats: { hp: 3000, max: 23, main: { range: 1300, rof: 6.5, dmg: 98, hs: 360, n: 3 } } },
  yorktown: { cls: 'carrier', fac: 'us', name: 'USS Yorktown', type: 'Portaaviones', hull: 0x4b5864, sup: 0x8b949a, deck: 0x7a6a50, plane: 'wildcat' },
  akagi: { cls: 'carrier', fac: 'jp', name: 'IJN Akagi', type: 'Portaaviones', hull: 0x595f63, sup: 0x6e7478, deck: 0x8a6a48, plane: 'zero', islandPort: true },
  gato: { cls: 'sub', fac: 'us', name: 'USS Wahoo (Gato)', type: 'Submarino', hull: 0x2c3237, sup: 0x3a4045, deck: 0x34393d },
  i15: { cls: 'sub', fac: 'jp', name: 'I-15 (Tipo B1)', type: 'Submarino', hull: 0x2e3133, sup: 0x3b3e40, deck: 0x35383a, stats: { torp: { n: 3, cd: 16, dmg: 190 } } },
  tclass: { cls: 'sub', fac: 'uk', name: 'HMS Tally-Ho (Clase T)', type: 'Submarino', hull: 0x4a5257, sup: 0x5a6267, deck: 0x50575b },
  u7c: { cls: 'sub', fac: 'de', name: 'U-552 (Tipo VII C)', type: 'U-Boot', hull: 0x6a7175, sup: 0x7b8286, deck: 0x6f6a5f },
  pt109: { cls: 'pt', fac: 'us', name: 'PT-109 (Elco)', type: 'Lancha torpedera', hull: 0x3b4a40, sup: 0x48584c, deck: 0x40503f },
  mtb: { cls: 'pt', fac: 'uk', name: 'MTB Vosper', type: 'Lancha torpedera', hull: 0x8c9599, sup: 0xa8afb2, deck: 0x707070 },
  sboot: { cls: 'pt', fac: 'de', name: 'S-Boot (Schnellboot)', type: 'Lancha torpedera', hull: 0x8d9397, sup: 0xa1a7aa, deck: 0x8a7a62, stats: { hp: 240, max: 54 } },
  // ---------- Aire ----------
  wildcat: { cls: 'fighter', fac: 'us', name: 'F4F Wildcat', type: 'Caza embarcado', len: 8.8, span: 11.6, radial: true, color: 0x6c7f93, under: 0xc8ccc8, stats: { hp: 170, max: 130, turn: 1.42 } },
  zero: { cls: 'fighter', fac: 'jp', name: 'A6M2 Zero', type: 'Caza embarcado', len: 9.1, span: 12, radial: true, color: 0xc9c5ae, cowl: 0x1d1d1d, stats: { hp: 104, max: 136, turn: 1.95 } },
  sbd: { cls: 'bomber', fac: 'us', name: 'SBD Dauntless', type: 'Bombardero en picado', len: 10.1, span: 12.7, radial: true, color: 0x6c8096 },
  val: { cls: 'bomber', fac: 'jp', name: 'D3A Val', type: 'Bombardero en picado', len: 10.2, span: 14.4, radial: true, color: 0x4f5c3d, fixedGear: true, stats: { hp: 210 } },
  p40: { cls: 'fighter', fac: 'uk', name: 'Kittyhawk (P-40)', type: 'Caza', len: 9.7, span: 11.4, color: 0xa88d61, sharkMouth: true, stats: { hp: 156, max: 132, turn: 1.45 } },
  hurricane: { cls: 'bomber', fac: 'uk', name: 'Hurricane IID', type: 'Cazabombardero', len: 9.8, span: 12.2, color: 0x9c845a, stats: { hp: 220, max: 122, turn: 1.25 } },
  bf109: { cls: 'fighter', fac: 'de', name: 'Bf 109 F-4 Trop', type: 'Caza', len: 9, span: 9.9, color: 0xb59d6c, nose: 0xe8e2d0, stats: { hp: 124, max: 145, turn: 1.6 } },
  mc202: { cls: 'fighter', fac: 'it', name: 'Macchi C.202 Folgore', type: 'Caza', len: 8.9, span: 10.6, color: 0xb6a070, stats: { hp: 120, max: 140, turn: 1.72 } },
  ju87: { cls: 'bomber', fac: 'de', name: 'Ju 87 Stuka', type: 'Bombardero en picado', len: 11.1, span: 13.8, color: 0x8a8158, fixedGear: true, gull: true, stats: { hp: 220, max: 108 } },
  p51: { cls: 'fighter', fac: 'us', name: 'P-51D Mustang', type: 'Caza de escolta', len: 9.8, span: 11.3, color: 0xb4b9bd, metal: true, stripes: true, stats: { hp: 150, max: 155, turn: 1.6 } },
  p47: { cls: 'bomber', fac: 'us', name: 'P-47 Thunderbolt', type: 'Cazabombardero', len: 11, span: 12.4, radial: true, color: 0x4b5320, stripes: true, stats: { hp: 270, max: 130, turn: 1.25, guns: { range: 320, rof: 0.08, dmg: 1.6 }, ammo: { guns: 800, bomb: 2 } } },
  bf109g: { cls: 'fighter', fac: 'de', name: 'Bf 109 G-6', type: 'Caza', len: 9, span: 9.9, color: 0x707a80, nose: 0xd8b42c, stats: { hp: 130, max: 148, turn: 1.55 } },
  fw190f: { cls: 'bomber', fac: 'de', name: 'Fw 190 F-8', type: 'Cazabombardero', len: 9, span: 10.5, radial: true, color: 0x6f797e, nose: 0x3a3f3a, stats: { hp: 250, max: 132, turn: 1.3, guns: { range: 320, rof: 0.08, dmg: 1.7 } } },
  // ---------- Tierra ----------
  sherman: { cls: 'tank', fac: 'us', name: 'M4A1 Sherman', type: 'Carro medio', color: 0x4b5320, L: 5.9, W: 2.6, H: 2.7, tur: 'cast', gun: 3.1, gr: 0.075, wheels: 6, wr: 0.42, glacis: 0.55, stats: { hp: 280, max: 27, gun: { range: 470, rof: 3.2, dmg: 55 }, armor: [0.9, 1.25, 1.6] } },
  sherman_uk: { cls: 'tank', fac: 'uk', name: 'Sherman II', type: 'Carro medio', color: 0xb9a27a, L: 5.9, W: 2.6, H: 2.7, tur: 'cast', gun: 3.1, gr: 0.075, wheels: 6, wr: 0.42, glacis: 0.55, stats: { hp: 280, max: 27, gun: { range: 470, rof: 3.2, dmg: 55 }, armor: [0.9, 1.25, 1.6] } },
  firefly: { cls: 'tank', fac: 'uk', name: 'Sherman Firefly', type: 'Carro medio (17 lb)', color: 0x55593a, L: 5.9, W: 2.6, H: 2.7, tur: 'cast', gun: 4.4, gr: 0.085, brake: true, wheels: 6, wr: 0.42, glacis: 0.55, stats: { hp: 270, max: 25, gun: { range: 580, rof: 3.9, dmg: 92 }, armor: [0.9, 1.25, 1.6] } },
  cromwell: { cls: 'tank', fac: 'uk', name: 'Cromwell IV', type: 'Carro crucero', color: 0x58593c, L: 6.4, W: 3.0, H: 2.5, tur: 'boxy', gun: 2.9, gr: 0.075, wheels: 5, wr: 0.6, christie: true, glacis: 0.15, stats: { hp: 240, max: 35, turn: 1.6, gun: { range: 450, rof: 3.0, dmg: 52 }, armor: [0.95, 1.25, 1.6] } },
  m10: { cls: 'tank', fac: 'us', name: 'M10 Wolverine', type: 'Cazacarros', color: 0x4b5320, L: 5.8, W: 3.0, H: 2.6, tur: 'open', gun: 3.6, gr: 0.08, wheels: 6, wr: 0.42, glacis: 0.6, stats: { hp: 220, max: 28, gun: { range: 560, rof: 3.6, dmg: 82 }, armor: [1.0, 1.35, 1.7] } },
  grant: { cls: 'tank', fac: 'uk', name: 'M3 Grant', type: 'Carro medio', color: 0xc0a77b, L: 5.6, W: 2.7, H: 3.1, tur: 'small', sponson: true, gun: 1.8, gr: 0.06, wheels: 6, wr: 0.42, glacis: 0.3, stats: { hp: 270, max: 22, gun: { range: 440, rof: 3.4, dmg: 52 }, armor: [0.95, 1.25, 1.6] } },
  crusader: { cls: 'tank', fac: 'uk', name: 'Crusader III', type: 'Carro crucero', color: 0xc7b083, L: 6, W: 2.6, H: 2.2, tur: 'angular', gun: 2.8, gr: 0.06, wheels: 5, wr: 0.62, christie: true, glacis: 0.2, stats: { hp: 200, max: 34, turn: 1.65, gun: { range: 430, rof: 2.6, dmg: 42 }, armor: [1.0, 1.3, 1.7] } },
  inf_us: { cls: 'inf', fac: 'us', name: 'Escuadra de fusileros', type: 'Infantería con bazuca', color: 0x5b5a3a, helmet: 0x4b4f30 },
  inf_uk: { cls: 'inf', fac: 'uk', name: 'Sección británica', type: 'Infantería con PIAT', color: 0x9a8762, helmet: 0x6b6340 },
  inf_dak: { cls: 'inf', fac: 'de', name: 'Afrika Korps', type: 'Infantería', color: 0xa38d62, helmet: 0x8f7d55 },
  inf_aus: { cls: 'inf', fac: 'uk', name: 'Infantería australiana', type: 'Infantería con fusil antitanque', color: 0xa08a5e, helmet: 0x7d6b48 },
  matilda: { cls: 'tank', fac: 'uk', name: 'Matilda II', type: 'Carro de infantería', color: 0xc4ae84, L: 5.6, W: 2.6, H: 2.5, tur: 'cast', gun: 1.8, gr: 0.06, wheels: 6, wr: 0.3, skirts: true, glacis: 0.4, stats: { hp: 340, max: 13, turn: 1.1, gun: { range: 400, rof: 2.6, dmg: 42 }, armor: [0.55, 0.85, 1.3] } },
  merchant: { cls: 'merchant', fac: 'uk', name: 'Mercante del convoy', type: 'Buque de carga', hull: 0x4a4a46, sup: 0xd8d2c0, deck: 0x6b5a46 },
  inf_jp: { cls: 'inf', fac: 'jp', name: 'Sección de infantería', type: 'Infantería con cargas antitanque', color: 0x7c7350, helmet: 0x6b6648 },
  at_jp: { cls: 'atgun', fac: 'jp', name: 'Cañón Tipo 1 (47 mm)', type: 'Cañón antitanque', color: 0x6d6a48, gun: 2.8 },
  chiha: { cls: 'tank', fac: 'jp', name: 'Tipo 97 Chi-Ha', type: 'Carro medio', color: 0x6d6a48, L: 5.5, W: 2.3, H: 2.2, tur: 'cast', gun: 1.4, gr: 0.075, wheels: 6, wr: 0.3, glacis: 0.3, stats: { hp: 190, max: 21, gun: { range: 380, rof: 3, dmg: 36 }, armor: [1.05, 1.35, 1.7] } },
  inf_de: { cls: 'inf', fac: 'de', name: 'Grupo de granaderos', type: 'Infantería con Panzerschreck', color: 0x5d6253, helmet: 0x4c5148 },
  at_us: { cls: 'atgun', fac: 'us', name: 'Cañón AT 57 mm M1', type: 'Cañón antitanque', color: 0x4b5320, gun: 3.2 },
  at_uk: { cls: 'atgun', fac: 'uk', name: 'Cañón de 6 libras', type: 'Cañón antitanque', color: 0xb9a27a, gun: 3.0 },
  pak40: { cls: 'atgun', fac: 'de', name: 'Pak 40 (75 mm)', type: 'Cañón antitanque', color: 0x7a7a62, gun: 3.6, brake: true, stats: { gun: { range: 580, rof: 3.6, dmg: 95 } } },
  pz3: { cls: 'tank', fac: 'de', name: 'Panzer III J', type: 'Carro medio', color: 0xb59f70, L: 5.6, W: 2.9, H: 2.5, tur: 'box', gun: 2.6, gr: 0.065, wheels: 6, wr: 0.38, glacis: 0.2, stats: { hp: 230, max: 25, gun: { range: 420, rof: 2.8, dmg: 42 }, armor: [0.95, 1.25, 1.65] } },
  pz4f2: { cls: 'tank', fac: 'de', name: 'Panzer IV F2', type: 'Carro medio', color: 0xb59f70, L: 5.9, W: 2.9, H: 2.7, tur: 'box', gun: 3.4, gr: 0.075, brake: true, wheels: 8, wr: 0.3, glacis: 0.2, stats: { hp: 270, max: 23, gun: { range: 520, rof: 3.3, dmg: 62 }, armor: [0.9, 1.25, 1.6] } },
  m13: { cls: 'tank', fac: 'it', name: 'Fiat M13/40', type: 'Carro medio', color: 0xbca577, L: 4.9, W: 2.2, H: 2.4, tur: 'box', gun: 2.0, gr: 0.055, wheels: 8, wr: 0.25, glacis: 0.25, scale: 0.95, stats: { hp: 170, max: 20, gun: { range: 380, rof: 3.0, dmg: 34 }, armor: [1.05, 1.35, 1.75] } },
  pz4h: { cls: 'tank', fac: 'de', name: 'Panzer IV H', type: 'Carro medio', color: 0xb4a171, camo: 0x5d6a3e, L: 5.9, W: 2.9, H: 2.7, tur: 'box', gun: 3.9, gr: 0.08, brake: true, skirts: true, wheels: 8, wr: 0.3, glacis: 0.2, stats: { hp: 280, max: 23, gun: { range: 540, rof: 3.4, dmg: 66 }, armor: [0.85, 1.2, 1.6] } },
  panther: { cls: 'tank', fac: 'de', name: 'Panther A', type: 'Carro medio', color: 0xb4a171, camo: 0x6b4b34, L: 6.9, W: 3.3, H: 2.9, tur: 'panther', gun: 5.2, gr: 0.085, brake: true, wheels: 8, wr: 0.5, overlap: true, glacis: 1.0, stats: { hp: 380, max: 26, gun: { range: 600, rof: 3.8, dmg: 88 }, armor: [0.55, 1.2, 1.55], tsp: 0.8 } },
  stug: { cls: 'tank', fac: 'de', name: 'StuG III G', type: 'Cañón de asalto', color: 0xb4a171, camo: 0x5d6a3e, L: 5.4, W: 2.9, H: 2.2, tur: 'casemate', gun: 3.4, gr: 0.08, brake: true, skirts: true, wheels: 6, wr: 0.38, glacis: 0.2, stats: { hp: 260, max: 24, gun: { range: 520, rof: 3.4, dmg: 70 }, armor: [0.7, 1.25, 1.6] } },
  tiger: { cls: 'tank', fac: 'de', name: 'Tiger I', type: 'Carro pesado', color: 0xb4a171, camo: 0x6b4b34, L: 6.3, W: 3.6, H: 3.0, tur: 'tiger', gun: 4.9, gr: 0.09, brake: true, wheels: 8, wr: 0.5, overlap: true, glacis: 0.1, stats: { hp: 480, max: 19, turn: 1.0, gun: { range: 620, rof: 4.4, dmg: 100 }, armor: [0.55, 0.9, 1.35], tsp: 0.55 } },
};

export const FAC_NAME = { us: 'EE. UU.', uk: 'Reino Unido', jp: 'Japón', de: 'Alemania', it: 'Italia' };

// Ritmo arcade: barcos y tanques más rápidos que en la realidad; el HUD muestra la velocidad "real" (dispK)
const PACE = { sea: { max: 1.45, acc: 2.0, turn: 1.3 }, land: { max: 1.4, acc: 1.8, turn: 1.2 } };
export const AMMO_NAME = { ap: 'Perforante (AP)', he: 'Explosiva (HE)' };
export function specOf(key) {
  const m = MODELS[key], c = CLS[m.cls], s = { ...c };
  if (m.stats) for (const k in m.stats) s[k] = typeof m.stats[k] === 'object' && !Array.isArray(m.stats[k]) ? { ...(c[k] || {}), ...m.stats[k] } : m.stats[k];
  const p = PACE[s.dom];
  if (p) { s.max *= p.max; s.acc *= p.acc; s.turn *= p.turn; s.dispK = 1 / p.max; } else s.dispK = 1;
  return s;
}
