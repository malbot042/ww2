import * as THREE from 'three';

// Estado compartido de la partida
export const G = {
  renderer: null, scene: null, camera: null, sun: null, hemi: null,
  ents: [], projs: [], player: null,
  battle: null, battleKey: null, front: null, map: null,
  objectives: [], tickets: { A: 0, E: 0 }, ticketsMax: 1,
  selection: new Set(), smokes: [],
  zoom: 300, targetZoom: 300, strategic: false,
  focus: new THREE.Vector3(), shake: 0,
  running: false, paused: false, demo: false, over: false, time: 0,
  stats: { kills: 0, lost: 0 }, campaign: null,
  unitsGroup: null,
};
