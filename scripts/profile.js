/* ============================================================
   HEXON BETA — Profile persistence + crypto helpers
   ============================================================
   Two responsibilities live here:

     1. Bridge wrappers around window.AndroidHexon (the Java side
        defined in MainActivity.java). They expose:
          - hasStoragePermission()  / requestStoragePermission()
          - saveProfile(name, json) / loadProfile(name)
          - listProfiles()          / profileExists(name)
        In a regular browser (no bridge) every call returns a sane
        no-op so the same JS works on desktop too.

     2. Two small crypto helpers used by the login flow and the
        admin activation codes:
          - sha256Hex(str)          — SHA-256, lower-case hex
          - hmacSha256Hex(key, str) — HMAC-SHA256, lower-case hex
        Both run on the standard `crypto.subtle` API that ships
        in every Android WebView since API 28. We don't rely on
        any node-only library.
   ============================================================ */
"use strict";

/* ---------- Android bridge wrapper ---------- */
const HexBridge = {
  available(){ return !!(typeof window !== "undefined" && window.AndroidHexon); },
  hasPermission(){
    try { return this.available() && !!window.AndroidHexon.hasStoragePermission(); }
    catch { return false; }
  },
  requestPermission(){
    try { if(this.available()) window.AndroidHexon.requestStoragePermission(); }
    catch {}
  },
  saveProfile(name, json){
    try { return this.available() && !!window.AndroidHexon.saveProfile(name||"", json||""); }
    catch { return false; }
  },
  loadProfile(name){
    try { return this.available() ? (window.AndroidHexon.loadProfile(name||"") || "") : ""; }
    catch { return ""; }
  },
  listProfiles(){
    try {
      if(!this.available()) return [];
      const raw = window.AndroidHexon.listProfiles() || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  },
  profileExists(name){
    try { return this.available() && !!window.AndroidHexon.profileExists(name||""); }
    catch { return false; }
  }
};

/* ---------- Crypto helpers ----------
   `crypto.subtle` returns ArrayBuffers; we always render them as
   lower-case hex because that's what the activation-code format
   uses on the wire. */
async function _digest(algoOrKey, data){
  const enc = new TextEncoder();
  if(typeof algoOrKey === "string"){
    const buf = await crypto.subtle.digest(algoOrKey, enc.encode(data));
    return _hex(buf);
  } else {
    const buf = await crypto.subtle.sign("HMAC", algoOrKey, enc.encode(data));
    return _hex(buf);
  }
}
function _hex(buf){
  const b = new Uint8Array(buf);
  let s = "";
  for(let i=0;i<b.length;i++) s += b[i].toString(16).padStart(2,"0");
  return s;
}
async function sha256Hex(str){
  return _digest("SHA-256", String(str||""));
}
async function hmacSha256Hex(secret, message){
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(String(secret||"")),
    { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  return _digest(key, String(message||""));
}

/* ---------- Profile file <-> state ----------
   The disk file is the *source of truth* on Android. localStorage
   is kept as a fast read-cache and a fallback for non-Android
   environments. Schema:

     { version: 1,
       nickname: "...",
       passwordHash: "<sha-256 hex>",
       state: <the full saveState() blob>,
       savedAt: <epoch ms> }

   No plaintext password is ever stored — we only keep the hash. */
const PROFILE_FILE_VERSION = 1;

function safeProfileName(name){
  return String(name||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,40);
}

async function buildProfileBlob(nickname, passwordHash){
  /* The saveState helper in storage.js builds the same shape used
     by localStorage. We piggy-back on it so disk and localStorage
     stay byte-for-byte identical. */
  const stateBlob = (typeof buildStateSnapshot === "function")
    ? buildStateSnapshot()
    : (typeof state === "object" ? state : {});
  return {
    version: PROFILE_FILE_VERSION,
    nickname: nickname,
    passwordHash: passwordHash,
    savedAt: Date.now(),
    state: stateBlob
  };
}

/* Per-nickname browser fallback. Lets non-Android web players also
   keep separate accounts on the same browser and enforces the
   password check on re-login. The key is salted with the safe-name
   so different player nicks never collide. */
const PROFILE_LS_PREFIX = "hexon.beta.profile.";
function profileLsKey(nick){ return PROFILE_LS_PREFIX + safeProfileName(nick); }

async function saveProfileToDisk(){
  const nick = state && state.profile && state.profile.nickname;
  const pwh  = state && state.profile && state.profile.passwordHash;
  if(!nick || !pwh) return false;
  const blob = await buildProfileBlob(nick, pwh);
  const json = JSON.stringify(blob);
  let wrote = false;
  /* Primary: Android disk (survives uninstall). */
  if(HexBridge.available() && HexBridge.hasPermission()){
    wrote = !!HexBridge.saveProfile(safeProfileName(nick), json) || wrote;
  }
  /* Fallback: browser localStorage so the in-browser flow can still
     verify the password on the next login. */
  try { localStorage.setItem(profileLsKey(nick), json); wrote = true; } catch {}
  return wrote;
}

function loadProfileFromDisk(nickname){
  /* Disk first (Android), then localStorage (web). Both branches return
     the parsed profile blob or null. */
  if(HexBridge.available()){
    const raw = HexBridge.loadProfile(safeProfileName(nickname));
    if(raw){ try { return JSON.parse(raw); } catch {} }
  }
  try {
    const raw = localStorage.getItem(profileLsKey(nickname));
    if(raw){ return JSON.parse(raw); }
  } catch {}
  return null;
}

/* ---------- Activation codes ----------
   Format on the wire (URL-safe, copy-pasteable):

     HX1-<TARGETID12>-<AMOUNT>-<NONCE>-<SIG10>

   where TARGETID12 is the player ID stripped of dashes, AMOUNT
   is the HEX delta as a base-10 integer, NONCE is a 6-char
   random base-32 string, and SIG10 is the first 10 hex chars
   of HMAC-SHA256(ACTIVATION_SECRET, "HX1|TARGET|AMOUNT|NONCE").
   The shared secret is a constant; this is *not* meant to
   defend against a determined attacker who decompiles the APK,
   only to keep casual cheaters from forging codes. */
const ACTIVATION_SECRET = "hex0n_beta_v1_activation_secret_2025";

function _b32nonce(len){
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; const r = new Uint32Array(len);
  if(crypto && crypto.getRandomValues) crypto.getRandomValues(r);
  else for(let i=0;i<len;i++) r[i] = Math.floor(Math.random()*0xffffffff);
  for(let i=0;i<len;i++) s += A[r[i] % A.length];
  return s;
}
function _strip(s){ return String(s||"").replace(/-/g,"").toUpperCase(); }

async function makeActivationCode(targetId, amount){
  const tid   = _strip(targetId);
  const amt   = Math.max(0, Math.floor(Number(amount)||0));
  const nonce = _b32nonce(6);
  const msg   = "HX1|" + tid + "|" + amt + "|" + nonce;
  const sig   = (await hmacSha256Hex(ACTIVATION_SECRET, msg)).slice(0, 10).toUpperCase();
  return "HX1-" + tid + "-" + amt + "-" + nonce + "-" + sig;
}

/* { ok:true, amount:N } on success, { ok:false, reason:".." } on failure. */
async function verifyActivationCode(code, myId){
  const parts = String(code||"").trim().toUpperCase().split("-");
  if(parts.length !== 5 || parts[0] !== "HX1") return { ok:false, reason:"format" };
  const [, tid, amtStr, nonce, sig] = parts;
  if(_strip(myId) !== tid) return { ok:false, reason:"wrong-id" };
  const amt = parseInt(amtStr, 10);
  if(!isFinite(amt) || amt <= 0 || amt > 10000000) return { ok:false, reason:"amount" };
  const msg = "HX1|" + tid + "|" + amt + "|" + nonce;
  const calc = (await hmacSha256Hex(ACTIVATION_SECRET, msg)).slice(0, 10).toUpperCase();
  if(calc !== sig) return { ok:false, reason:"bad-sig" };
  /* Single-use: refuse a nonce that's already been redeemed on this
     device. The list lives on state and persists with the profile. */
  if(!state.usedActivationCodes) state.usedActivationCodes = [];
  if(state.usedActivationCodes.indexOf(nonce) >= 0) return { ok:false, reason:"used" };
  state.usedActivationCodes.push(nonce);
  return { ok:true, amount: amt, nonce };
}
