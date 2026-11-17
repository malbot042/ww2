// Guardado local (localStorage): opciones, campaña en curso y récords por batalla
import { G } from './state.js';

const KEY = 'frentes1939-45';
let data = { v: 1, opts: null, vol: null, campaign: null, records: {} };
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) data = { ...data, ...s, records: s.records || {} }; } catch (e) { }
  if (data.opts) G.opts = { ...G.opts, ...data.opts };
  if (data.vol) G.vol = { ...G.vol, ...data.vol };
  return data;
}
function write() { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
export function saveOptions() { data.opts = { ...G.opts }; data.vol = { ...G.vol }; write(); }
export const savedCampaign = () => data.campaign;
export function saveCampaign(c) { data.campaign = c ? JSON.parse(JSON.stringify({ ...c, snap: null })) : null; write(); }
export function record(key, score, win) {
  const r = data.records[key] || { best: 0, wins: 0, plays: 0 };
  r.plays++; if (win) r.wins++;
  const isNew = score > r.best; if (isNew) r.best = score;
  data.records[key] = r; write(); return isNew;
}
export const recordOf = key => data.records[key];
export function clearSave() { data = { v: 1, opts: data.opts, vol: data.vol, campaign: null, records: {} }; write(); }
