/* ---------- Leaderboards (simulated) ---------- */
const FAKE_NAMES = ["Nova","Kairo","Akira","Sora","Lumen","Vega","Orion","Zephyr","Mira","Iris","Kai","Rune","Sage","Echo","Lyra","Pax","Onyx","Atlas","Lux","Nyx","Cyra","Polaris","Hex","Tao","Juno","Astrid","Selene","Cassio","Calix","Helios","Aether","Vesper","Ronin","Saoirse","Aurel","Sable","Thal","Nikko","Reza","Mika","Ezra","Ines","Lior","Maya","Niko","Yuna","Zara","Liyo","Aria","Bex"];
function buildLeaderboard(){
  const seed = hashStr("hexon-leaderboards-v1");
  const rnd = mulberry32(seed);
  const list = [];
  for(let i=0;i<60;i++){
    const name = FAKE_NAMES[Math.floor(rnd()*FAKE_NAMES.length)] + (rnd()<0.6 ? Math.floor(rnd()*99) : "");
    const id = "HX-" + Math.random().toString(36).slice(2,7).toUpperCase() + "-" + Math.floor(rnd()*9999);
    // Score distribution: highest ~50k, decay
    const base = Math.floor(40000 * Math.exp(-i*0.045));
    const jitter = Math.floor(rnd()*5000);
    list.push({ name, id, score: base + jitter, fake:true });
  }
  list.sort((a,b)=>b.score-a.score);
  return list;
}
function updateLeaderboardsForMe(){
  // remove existing "me" entries
  state.leaderboards = state.leaderboards.filter(e => !e.me);
  state.leaderboards.push({ name: state.profile.nickname, id: state.profile.id, score: state.stats.best||0, me:true });
  state.leaderboards.sort((a,b)=>b.score-a.score);
}
function ensureLeaderboards(){
  if(!state.leaderboards || state.leaderboards.length === 0){
    state.leaderboards = buildLeaderboard();
  }
  updateLeaderboardsForMe();
}
function renderLeaderboards(){
  ensureLeaderboards();
  const tbl = $("#lb-table");
  tbl.innerHTML = "";
  const headers = [
    {k:"lb.rank", cls:""},
    {k:"lb.name", cls:""},
    {k:"lb.id", cls:"col-id"},
    {k:"lb.score", cls:""},
  ];
  headers.forEach(h=>{
    const hd = document.createElement("div"); hd.className = "hd " + h.cls; hd.textContent = t(h.k); tbl.appendChild(hd);
  });
  state.leaderboards.slice(0, 50).forEach((row, i)=>{
    const me = row.me;
    const rk = document.createElement("div"); rk.className = "rk" + (me ? " me":""); rk.textContent = "#"+(i+1);
    const nm = document.createElement("div"); nm.className = (me?"me":""); nm.textContent = (me ? "[" + t("common.you") + "] " : "") + (row.name || "—");
    const id = document.createElement("div"); id.className = "col-id " + (me?"me":""); id.style.fontFamily="'JetBrains Mono',monospace"; id.style.fontSize="12px"; id.style.color="var(--fg-dim)"; id.textContent = row.id || "—";
    const sc = document.createElement("div"); sc.className = "sc" + (me?" me":""); sc.textContent = (row.score||0).toLocaleString();
    tbl.appendChild(rk); tbl.appendChild(nm); tbl.appendChild(id); tbl.appendChild(sc);
  });
}

