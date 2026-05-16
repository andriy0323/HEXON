/* ---------- Storage ---------- */
const STORE_KEY = "hexon.beta.v1";
function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
function saveState(){
  try{
    const copy = {
      profile: state.profile,
      stats: state.stats,
      settings: state.settings,
      achievements: Array.from(state.achievements),
      hidden: state.hidden,
      dailyTasks: state.dailyTasks,
      leaderboards: state.leaderboards,
      wallet: state.wallet,
      skins:  state.skins,
      run: null, // not persisted across reloads (live game state)
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(copy));
  }catch{}
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

