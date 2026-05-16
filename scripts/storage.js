/* ---------- Storage ---------- */
const STORE_KEY = "hexon.beta.v1";
function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
/* Build the JSON-able snapshot of the live `state`. Shared by
   saveState (writes to localStorage) and the Android bridge
   (writes the same blob to Documents/HEXON/<nick>.json so the
   profile survives an uninstall). */
function buildStateSnapshot(){
  return {
    profile: state.profile,
    stats: state.stats,
    settings: state.settings,
    achievements: Array.from(state.achievements || []),
    hidden: state.hidden,
    dailyTasks: state.dailyTasks,
    leaderboards: state.leaderboards,
    wallet: state.wallet,
    skins:  state.skins,
    usedActivationCodes: state.usedActivationCodes || [],
    run: null, // not persisted across reloads (live game state)
  };
}
function saveState(){
  try{
    const copy = buildStateSnapshot();
    localStorage.setItem(STORE_KEY, JSON.stringify(copy));
  }catch{}
  /* Mirror to disk on Android so the profile survives reinstall.
     Fire-and-forget; absence of the bridge / permission is fine. */
  try {
    if (typeof saveProfileToDisk === "function") saveProfileToDisk();
  } catch {}
}

/* The player ID is supposed to be permanent — even a hard reset of all
   game data should leave it intact. We mirror it to its own key so we
   can resurrect it after `localStorage.removeItem(STORE_KEY)`. */
const PLAYER_ID_KEY = "hexon.beta.playerId";
function loadPermanentPlayerId(){
  try { return localStorage.getItem(PLAYER_ID_KEY) || ""; } catch { return ""; }
}
function savePermanentPlayerId(id){
  try { localStorage.setItem(PLAYER_ID_KEY, id); } catch {}
}

