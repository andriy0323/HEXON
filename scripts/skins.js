/* ============================================================
   HEXON BETA — Piece skins
   ============================================================
   A "skin" is a named palette + accent colour that re-paints every
   piece, tray cell, board cell, and shop preview. Skins live in
   state.skins (equipped + unlocked) and are persisted via
   storage.js. Players unlock new skins from the in-game shop.

   Adding a skin: append an entry to SKINS with a unique id, a
   localisation key (so i18n can translate the name later), a
   price in HEX coins, and a 6-colour palette. The default skin
   is free and pre-equipped.
   ============================================================ */
"use strict";

const SKINS = {
  default: {
    name: "Класична",
    price: 0,
    accent: "#7c5cff",
    palette: [
      "#7c5cff","#24bdff","#3ddc97","#ffb454","#ff6470",
      "#a766ff","#22d3ee","#facc15","#f472b6","#34d399",
    ],
  },
  neon: {
    name: "Неон",
    price: 800,
    accent: "#39ff14",
    palette: [
      "#39ff14","#ff00ff","#00ffff","#ffea00","#ff3df0",
      "#7cff8a","#5cffff","#fff04d","#ff6dff","#a3ff5c",
    ],
  },
  aurora: {
    name: "Аврора",
    price: 1500,
    accent: "#7CF1B8",
    palette: [
      "#7cf1b8","#6cc9ff","#a98bff","#ffd1f0","#6affd3",
      "#92d8ff","#c2a4ff","#ffb6e9","#73f3c5","#88c8ff",
    ],
  },
  ocean: {
    name: "Океан",
    price: 2500,
    accent: "#1097d6",
    palette: [
      "#1097d6","#0ec8b6","#2c5fbf","#7cd9ff","#3ddc97",
      "#1a5fa3","#0fbfd4","#5bb1ff","#23b8a1","#3a7cd8",
    ],
  },
  sunset: {
    name: "Захід",
    price: 5000,
    accent: "#ff7a59",
    palette: [
      "#ff7a59","#ffb454","#ff5e9e","#ffd166","#ef476f",
      "#ff8e5e","#ffc06b","#ff77b2","#ffd884","#f55a85",
    ],
  },
  pastel: {
    name: "Пастель",
    price: 3000,
    accent: "#fcb1e5",
    palette: [
      "#fcb1e5","#b1d6fc","#c7fcb1","#fcd6b1","#d6b1fc",
      "#fcc6c6","#b1f0fc","#e7fcb1","#fce0b1","#cab1fc",
    ],
  },
  ember: {
    name: "Жар",
    price: 8000,
    accent: "#ff3d00",
    palette: [
      "#ff3d00","#ff7300","#ffb300","#ffd000","#c41e3a",
      "#ff5722","#ff9a3a","#ffc23a","#ffea3a","#e63a4d",
    ],
  },
  galaxy: {
    name: "Галактика",
    price: 12000,
    accent: "#9b5cff",
    palette: [
      "#9b5cff","#4a3aff","#ff5cff","#5cf6ff","#ffd166",
      "#7d3aff","#3a4bff","#e74cff","#3acaff","#ffe9a3",
    ],
  },
  mono: {
    name: "Моно",
    price: 1000,
    accent: "#e6e9f5",
    palette: [
      "#e6e9f5","#bcc1d6","#9aa0b8","#7a8099","#5d6280",
      "#cad0e3","#a8aec8","#888fac","#6d7390","#4f5470",
    ],
  },
};

/* The list order used by the shop grid. Default comes first so the
   player always sees the "equipped" pill at the top. */
const SHOP_SKIN_ORDER = ["default","neon","aurora","ocean","pastel","sunset","ember","galaxy","mono"];

function currentSkinId(){
  return (state.skins && state.skins.equipped) || "default";
}
function currentSkin(){
  return SKINS[currentSkinId()] || SKINS.default;
}
function currentPalette(){
  return currentSkin().palette;
}
function isSkinUnlocked(id){
  return !!(state.skins && Array.isArray(state.skins.unlocked) && state.skins.unlocked.indexOf(id) >= 0);
}
function unlockSkin(id){
  if(!SKINS[id]) return false;
  if(!state.skins) state.skins = { equipped:"default", unlocked:["default"] };
  if(!Array.isArray(state.skins.unlocked)) state.skins.unlocked = ["default"];
  if(state.skins.unlocked.indexOf(id) < 0) state.skins.unlocked.push(id);
  return true;
}
function equipSkin(id){
  if(!SKINS[id]) return false;
  if(!isSkinUnlocked(id)) return false;
  state.skins.equipped = id;
  applySkinAccent();
  return true;
}
/* Push the equipped skin's accent into a CSS custom property so the
   menu, HUD, and shop can tint themselves to match the current
   piece palette without re-reading the JS state. */
function applySkinAccent(){
  const s = currentSkin();
  document.documentElement.style.setProperty("--skin-accent", s.accent || "#7c5cff");
}
