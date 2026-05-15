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
      run: null, // not persisted across reloads (live game state)
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(copy));
  }catch{}
}

