/* ============================================================
   HEXON BETA — UI: login, menu, screens, settings, dropdowns
   ============================================================ */
"use strict";

/* ---------- Login / Profile setup ---------- */
function showLogin() {
  $("#login-screen").style.display = "";
  $("#app").style.display = "none";
}
function showApp() {
  $("#login-screen").style.display = "none";
  $("#app").style.display = "flex";
}
function registerLoginDay() {
  const key = todayKey();
  state.profile.loginDays = state.profile.loginDays || [];
  if (!state.profile.loginDays.includes(key)) {
    state.profile.loginDays.push(key);
  }
  state.profile.lastLoginDay = Date.now();
  evaluateAchievements();
}

let loginLangDD = null;
let setLangDD = null;
let currentScreen = "menu";

/* ---------- Device profile ---------- */
const DEVICE_OPTIONS = ["pc", "laptop", "tablet", "phone"];

function detectDevice() {
  const w = window.innerWidth;
  const ua = (navigator.userAgent || "").toLowerCase();
  const touch = matchMedia("(pointer: coarse)").matches;
  if (/ipad|tablet|playbook|silk/.test(ua) || (touch && w >= 720)) return "tablet";
  if (/iphone|ipod|android.*mobile|mobile/.test(ua) || (touch && w < 720)) return "phone";
  if (w >= 1280) return "pc";
  return "laptop";
}

function effectiveDevice() {
  const v = state.settings.device || "auto";
  return v === "auto" ? detectDevice() : v;
}

function applyDeviceProfile(device, opts) {
  const final = device === "auto" ? detectDevice() : device;
  document.documentElement.setAttribute("data-device", final);
  document.documentElement.setAttribute("data-device-setting", device);
  if (opts && opts.toast) {
    toast(t("toast.device", { device: t("device." + final) }), "info");
  }
}

function onResizeMaybeApplyDevice() {
  if ((state.settings.device || "auto") === "auto") {
    applyDeviceProfile("auto");
  }
}

function init() {
  const persisted = loadState();
  if (persisted) {
    Object.assign(state.profile, persisted.profile || {});
    Object.assign(state.stats, persisted.stats || {});
    Object.assign(state.settings, persisted.settings || {});
    state.hidden = Object.assign({}, state.hidden, persisted.hidden || {});
    state.dailyTasks = persisted.dailyTasks || state.dailyTasks;
    state.achievements = new Set(persisted.achievements || []);
    state.leaderboards = persisted.leaderboards || [];
    if (persisted.wallet) state.wallet = Object.assign(state.wallet || { coins:0, lastDailyClaim:0 }, persisted.wallet);
    if (persisted.skins)  state.skins  = Object.assign(state.skins  || { equipped:"default", unlocked:["default"] }, persisted.skins);
  }

  /* Resurrect a permanent player ID from a dedicated key. This survives
     "Reset all" (which clears the main state) so the ID truly never
     changes for the lifetime of the install. */
  const perma = (typeof loadPermanentPlayerId === "function") ? loadPermanentPlayerId() : "";
  if (perma && !state.profile.id) state.profile.id = perma;
  if (!state.profile.id) state.profile.id = genId();
  if (typeof savePermanentPlayerId === "function") savePermanentPlayerId(state.profile.id);

  // theme & lang
  document.documentElement.setAttribute("data-theme", state.settings.theme || "dark");
  applyDeviceProfile(state.settings.device || "auto");
  if (typeof applySkinAccent === "function") applySkinAccent();
  window.addEventListener("resize", onResizeMaybeApplyDevice, { passive: true });

  // Build login lang dropdown
  loginLangDD = buildLangDropdown($("#login-lang-dropdown"), {
    value: state.settings.lang || "uk",
    onChange: (code) => {
      state.settings.lang = code;
      applyI18n();
      saveState();
    },
  });

  // Apply i18n
  applyI18n();

  // Build the device picker on the login screen. Each chip pins a
  // layout density; the "remember" toggle controls whether the choice
  // is restored next time we hit the login screen.
  setupLoginDevicePicker();

  // bind login
  const nickInput = $("#nickname-input");
  const pwdInput  = $("#password-input");
  const nickCount = $("#nick-count");
  const errBox    = $("#login-error");
  const permBox   = $("#login-perm");
  const pwToggle  = $("#password-toggle");

  if (state.profile.nickname) {
    nickInput.value = state.profile.nickname;
    nickCount.textContent = state.profile.nickname.length + "/20";
  }
  nickInput.addEventListener("input", () => {
    nickCount.textContent = nickInput.value.length + "/20";
    hideLoginError();
  });
  pwdInput.addEventListener("input", () => hideLoginError());
  pwToggle.addEventListener("click", () => {
    pwdInput.type = pwdInput.type === "password" ? "text" : "password";
    pwToggle.textContent = pwdInput.type === "password"
      ? t("login.show") || "show"
      : t("login.hide") || "hide";
  });

  // Permission UX: only show the file-access banner if we're inside the
  // Android WebView and the user hasn't granted it yet. Browser players
  // never see it.
  refreshLoginPermBanner();
  const permBtn = $("#login-perm-grant");
  if (permBtn) permBtn.addEventListener("click", () => {
    if (typeof HexBridge !== "undefined") {
      HexBridge.requestPermission();
      // Re-check on focus — when the user returns from settings the page
      // gets focus again.
      setTimeout(refreshLoginPermBanner, 250);
    }
  });
  window.addEventListener("focus", refreshLoginPermBanner);

  $("#login-confirm").addEventListener("click", handleLoginConfirm);
  nickInput.addEventListener("keydown", e => { if (e.key === "Enter") pwdInput.focus(); });
  pwdInput.addEventListener("keydown", e => { if (e.key === "Enter") handleLoginConfirm(); });

  // auto-resume if already registered AND we have a password hash (legacy
  // saves without one fall through to the login screen so the player can
  // set a password the first time they open the new build).
  if (state.profile.nickname && state.profile.id && state.profile.passwordHash) {
    registerLoginDay();
    enterApp();
  } else {
    showLogin();
  }
}

function showLoginError(msg){
  const box = document.getElementById("login-error");
  if(!box) return;
  box.textContent = msg;
  box.hidden = false;
}
function hideLoginError(){
  const box = document.getElementById("login-error");
  if(box) box.hidden = true;
}
function refreshLoginPermBanner(){
  const banner = document.getElementById("login-perm");
  if(!banner) return;
  const onAndroid = typeof HexBridge !== "undefined" && HexBridge.available && HexBridge.available();
  const hasPerm   = onAndroid && HexBridge.hasPermission && HexBridge.hasPermission();
  banner.hidden = !onAndroid || hasPerm;
}

/* Login / register flow ----------------------------------------------
   - If a profile file already exists for `nickname` on disk, we *must*
     match its password hash. On success we replace the in-memory state
     with the loaded blob and continue.
   - Otherwise we treat the form as a new registration: the nickname
     becomes ours, the new password hash is stored, and `state` is
     written back to disk on the next saveState().
   - Empty nicknames or empty passwords are rejected — both are required. */
async function handleLoginConfirm(){
  const nickInput = document.getElementById("nickname-input");
  const pwdInput  = document.getElementById("password-input");
  const name = (nickInput.value || "").trim();
  const pwd  = (pwdInput.value  || "").trim();
  if(!name){ showLoginError(t("login.err.no-name") || "Введіть нік"); return; }
  if(pwd.length < 4){ showLoginError(t("login.err.weak-pass") || "Пароль мін. 4 символи"); return; }

  const safeName = (typeof safeProfileName === "function") ? safeProfileName(name) : name.toLowerCase();
  const pwHash   = await sha256Hex(pwd);

  /* Try loading a saved profile for this nickname first. On Android the
     disk bridge is consulted; in the browser this falls back to the
     per-nickname localStorage cache built by saveProfileToDisk. */
  let loaded = (typeof loadProfileFromDisk === "function")
    ? loadProfileFromDisk(name) : null;
  if (loaded && loaded.passwordHash && loaded.passwordHash !== pwHash){
    showLoginError(t("login.err.bad-pass") || "Невірний пароль");
    return;
  }
  if (loaded && loaded.state){
    /* Restore everything from disk and continue. The disk blob's state
       carries its own profile.id so we don't generate a new one. */
    applyLoadedSnapshot(loaded.state);
    state.profile.nickname = name.slice(0, 20);
    state.profile.passwordHash = pwHash;
    if (!state.profile.id) state.profile.id = genId();
  } else {
    /* Fresh registration on this device. We deliberately mint a NEW
       HEXON ID rather than reusing whatever was left over in state,
       so different accounts always have different IDs. The
       per-nickname profile cache is the new "permanent" anchor. */
    state.profile.nickname = name.slice(0, 20);
    state.profile.passwordHash = pwHash;
    state.profile.id = genId();
    state.profile.registeredAt = Date.now();
    state.profile.lastLoginDay = 0;
    state.profile.loginDays = [];
    /* Also reset wallet / skins / stats so the fresh account doesn't
       inherit the previously-active account's progress. */
    if (state.wallet) { state.wallet.coins = 0; state.wallet.lastDailyClaim = 0; }
    if (state.skins)  { state.skins.equipped = "default"; state.skins.unlocked = ["default"]; }
    if (state.achievements) state.achievements = new Set();
    state.usedActivationCodes = [];
  }
  if (typeof savePermanentPlayerId === "function") savePermanentPlayerId(state.profile.id);
  registerLoginDay();
  saveState();
  enterApp();
  toast(t("toast.welcome", { name: state.profile.nickname }), "success");
}

/* Copy fields from a saved snapshot into the live state. We don't just
   replace `state` because other modules hold a direct reference to it. */
function applyLoadedSnapshot(snap){
  if(!snap || typeof snap !== "object") return;
  const k = ["profile","stats","settings","hidden","dailyTasks","leaderboards","wallet","skins","usedActivationCodes"];
  k.forEach(key => { if(snap[key] !== undefined) state[key] = snap[key]; });
  state.achievements = new Set(Array.isArray(snap.achievements) ? snap.achievements : []);
  state.run = null;
}

function setupLoginDevicePicker() {
  const grid = $("#login-device-grid");
  if (!grid) return;
  // If "remember" is OFF we treat the saved device as "auto" for the
  // purposes of the picker so the user makes a fresh choice each time.
  const initial = (state.settings.rememberDevice === false) ? "auto" : (state.settings.device || "auto");
  paintDeviceGrid(grid, initial, (code) => {
    state.settings.device = code;
    applyDeviceProfile(code);
    saveState();
    paintDeviceGrid(grid, code);
  });
  const rememberBtn = $("#login-remember");
  if (rememberBtn) {
    const sync = () => rememberBtn.classList.toggle("on", !!state.settings.rememberDevice);
    sync();
    rememberBtn.addEventListener("click", () => {
      state.settings.rememberDevice = !state.settings.rememberDevice;
      sync();
      saveState();
    });
  }
}

function paintDeviceGrid(grid, selected, onPick) {
  const items = [
    { code: "pc",     i18n: "device.pc",     icon: "i-monitor"   },
    { code: "laptop", i18n: "device.laptop", icon: "i-laptop"    },
    { code: "tablet", i18n: "device.tablet", icon: "i-tablet"    },
    { code: "phone",  i18n: "device.phone",  icon: "i-smartphone" },
    { code: "auto",   i18n: "login.detect",  icon: "i-bolt"      },
  ];
  if (onPick) grid.innerHTML = "";
  if (onPick || !grid.children.length) {
    grid.innerHTML = items.map(it => (
      '<button class="device-card" data-dev="' + it.code + '" type="button">' +
      '<svg class="ic-svg"><use href="#' + it.icon + '"/></svg>' +
      '<span data-i18n="' + it.i18n + '">' + t(it.i18n) + '</span>' +
      '</button>'
    )).join("");
    grid.querySelectorAll(".device-card").forEach(btn => {
      btn.addEventListener("click", () => onPick && onPick(btn.dataset.dev));
    });
  }
  grid.querySelectorAll(".device-card").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.dev === selected);
  });
}

function enterApp() {
  showApp();
  buildBoardDom();
  startGame();
  bindAppEvents();
  if (typeof initShopWiring === "function") initShopWiring();
  if (typeof renderWallet === "function") renderWallet();
  refreshAllUI();
  // Stats avg uses totalScoreFromGames — backfill if missing
  if (typeof state.stats.totalScoreFromGames !== "number") {
    state.stats.totalScoreFromGames = (state.stats.best || 0); // best-effort
  }
  // Start at the menu screen by default.
  go("menu");
}

/* ---------- Screen navigation ----------
   Replaces the old tab system. Each navigable area (menu, game,
   settings, tasks, stats, profile, leaderboards, achievements)
   is its own full-viewport screen. */
function go(screen) {
  const target = document.querySelector('[data-screen="' + screen + '"]');
  if (!target) return;
  $$(".screen").forEach(s => s.classList.toggle("active", s.dataset.screen === screen));
  currentScreen = screen;
  // refresh data when entering a section
  if (screen === "menu") renderMenu();
  if (screen === "stats") renderStats();
  if (screen === "profile") renderProfile();
  if (screen === "tasks") renderTasks();
  if (screen === "leaderboards") renderLeaderboards();
  if (screen === "achievements") renderAchievements();
  if (screen === "shop" && typeof renderShop === "function") renderShop();
  if (typeof renderWallet === "function") renderWallet();
  if (screen === "game") updateHUD();
}

/* Backwards-compatible alias used by older callers (e.g. game over modal). */
function activateTab(name) { go(name); }

/* ---------- Menu ---------- */
function renderMenu() {
  const name = state.profile.nickname || "Player";
  const { lvl } = levelInfo(state.stats.xp || 0);
  $("#menu-avatar").textContent = name.slice(0, 1).toUpperCase();
  $("#menu-name").textContent = name;
  $("#menu-level").textContent = lvl;
  $("#menu-best").textContent = (state.stats.best || 0).toLocaleString();
  $("#menu-card-best").textContent = (state.stats.best || 0).toLocaleString();
  $("#menu-card-level").textContent = lvl;
  /* Permanent player ID printed under the user pill (e.g. "ID HX-AB3C4-DE5F6"). */
  const idEl = $("#menu-player-id");
  if (idEl) idEl.textContent = "ID " + (state.profile.id || "—");
  /* Shop header coin amount mirrors the HUD pill. */
  const head = document.getElementById("shop-head-amount");
  if (head && typeof getCoins === "function") head.textContent = (typeof formatCoins === "function") ? formatCoins(getCoins()) : String(getCoins());
}

/* ---------- App events ---------- */
function bindAppEvents() {
  // navigation buttons (menu tiles, play card, back buttons)
  $$("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.go));
  });

  // settings: language dropdown
  setLangDD = buildLangDropdown($("#set-lang-dropdown"), {
    value: state.settings.lang || "uk",
    onChange: (code) => {
      state.settings.lang = code;
      applyI18n();
      renderAllText();
      saveState();
      if (loginLangDD) loginLangDD.setValue(code);
    },
  });

  // theme
  document.querySelectorAll("#set-theme button").forEach(b => {
    if (b.dataset.val === state.settings.theme) b.classList.add("on"); else b.classList.remove("on");
    b.addEventListener("click", () => {
      state.settings.theme = b.dataset.val;
      document.documentElement.setAttribute("data-theme", state.settings.theme);
      document.querySelectorAll("#set-theme button").forEach(x => x.classList.toggle("on", x.dataset.val === state.settings.theme));
      saveState();
    });
  });

  // sound / vibration
  const soundBtn = $("#set-sound");
  soundBtn.classList.toggle("on", !!state.settings.sound);
  soundBtn.addEventListener("click", () => {
    state.settings.sound = !state.settings.sound;
    soundBtn.classList.toggle("on", state.settings.sound);
    saveState();
    if (state.settings.sound) sfx.toast();
  });
  const vibBtn = $("#set-vibrate");
  vibBtn.classList.toggle("on", !!state.settings.vibration);
  vibBtn.addEventListener("click", () => {
    state.settings.vibration = !state.settings.vibration;
    vibBtn.classList.toggle("on", state.settings.vibration);
    saveState();
    if (state.settings.vibration) vibrate(20);
  });

  $("#btn-reset-all").addEventListener("click", () => {
    // Tiny inline confirm using the toast stack — `confirm()` is jarring
    // inside a WebView. Two clicks within 3s commit the reset.
    const btn = $("#btn-reset-all");
    if (btn.dataset.armed === "1") {
      btn.dataset.armed = "0";
      /* Reset everything EXCEPT the permanent player ID, which lives
         under its own key. The user explicitly asked that the ID never
         change after being issued. */
      const keptId = (typeof loadPermanentPlayerId === "function") ? loadPermanentPlayerId() : (state.profile && state.profile.id);
      localStorage.removeItem(STORE_KEY);
      if (keptId && typeof savePermanentPlayerId === "function") savePermanentPlayerId(keptId);
      location.reload();
      return;
    }
    btn.dataset.armed = "1";
    btn.classList.add("armed");
    toast(t("set.reset.sub") + " — " + t("set.reset.btn") + " ?", "warn");
    setTimeout(() => { btn.dataset.armed = "0"; btn.classList.remove("armed"); }, 3000);
  });

  // restart
  $("#btn-restart").addEventListener("click", () => {
    // count abandoned run into games if score>0
    if (state.run && state.run.score > 0) {
      state.stats.games = (state.stats.games || 0) + 1;
      state.stats.totalScoreFromGames = (state.stats.totalScoreFromGames || 0) + state.run.score;
      state.stats.totalTimeMs = (state.stats.totalTimeMs || 0) + (Date.now() - state.run.startedAt);
      bumpDailyTask("games", 1);
      updateLeaderboardsForMe();
      evaluateAchievements();
    }
    startGame();
  });

  // how to
  $("#btn-howto").addEventListener("click", () => openModal("#modal-howto"));
  $("#howto-close").addEventListener("click", () => closeModal("#modal-howto"));
  $("#modal-howto").addEventListener("click", e => { if (e.target.id === "modal-howto") closeModal("#modal-howto"); });

  // Exit / leave-confirmation modal opened from the main menu.
  // The grid offers four intents instead of a yes/no — "stay",
  // "pause" (back to menu), "sign out" (clear profile), and
  // "quit" (best-effort close + sign out).
  $("#menu-exit").addEventListener("click", () => openModal("#modal-exit"));
  $("#modal-exit").addEventListener("click", e => { if (e.target.id === "modal-exit") closeModal("#modal-exit"); });
  $("#exit-stay").addEventListener("click", () => { closeModal("#modal-exit"); });
  $("#exit-pause").addEventListener("click", () => { closeModal("#modal-exit"); go("menu"); });
  $("#exit-signout").addEventListener("click", () => {
    /* "Sign out" clears the nickname and password hash so the login
       screen shows again. We don't touch the file on disk — re-typing
       the same nick + password restores the saved profile. The
       permanent HEXON ID stays preserved in its mirror key for the
       next fresh registration. */
    state.profile.nickname = "";
    state.profile.passwordHash = "";
    saveState();
    if (typeof savePermanentPlayerId === "function" && state.profile.id) savePermanentPlayerId(state.profile.id);
    location.reload();
  });
  $("#exit-quit").addEventListener("click", () => {
    /* Best-effort "quit": works in WebView (Android JS bridge) when
       present, in PWAs, and falls back to history.back() / about:blank
       in regular browsers. We also clear the active run so re-opening
       starts fresh. */
    state.run = null; saveState();
    if (window.AndroidHexon && typeof window.AndroidHexon.exit === "function") {
      try { window.AndroidHexon.exit(); return; } catch {}
    }
    try { window.close(); } catch {}
    setTimeout(() => { window.location.href = "about:blank"; }, 150);
  });

  // game over modal
  // (endGame already records totalScoreFromGames for us, so the
  //  buttons here just close the modal and reset the run.)
  $("#m-play-again").addEventListener("click", () => {
    closeModal("#modal-gameover");
    startGame();
    refreshAllUI();
  });
  $("#m-menu").addEventListener("click", () => {
    closeModal("#modal-gameover");
    startGame();
    refreshAllUI();
    go("menu");
  });

  // achievements filter & search
  document.querySelectorAll("#ach-filter button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#ach-filter button").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      achFilter = b.dataset.val;
      renderAchievements();
    });
  });
  const search = $("#ach-search");
  search.addEventListener("input", () => {
    achQuery = search.value;
    renderAchievements();
  });

  // logout from the profile screen now also goes through the exit modal
  $("#btn-logout").addEventListener("click", () => openModal("#modal-exit"));

  // profile: copy ID — click on the badge OR on the dedicated button
  const copyId = async () => {
    const id = state.profile.id || "";
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // Fallback for browsers without async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = id; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    toast(t("profile.copied"), "success");
  };
  const profCopyBtn = $("#prof-copy");
  const profIdBadge = $("#prof-id");
  if (profCopyBtn) profCopyBtn.addEventListener("click", copyId);
  if (profIdBadge) profIdBadge.addEventListener("click", copyId);

  // settings: device picker
  const setGrid = $("#set-device-grid");
  if (setGrid) {
    paintDeviceGrid(setGrid, state.settings.device || "auto", (code) => {
      state.settings.device = code;
      applyDeviceProfile(code, { toast: true });
      saveState();
      paintDeviceGrid(setGrid, code);
    });
  }
}

function renderAllText() {
  applyI18n();
  renderTasks();
  renderLeaderboards();
  renderAchievements();
  renderMenu();
  // sync dropdowns
  if (loginLangDD) loginLangDD.setValue(state.settings.lang);
  if (setLangDD) setLangDD.setValue(state.settings.lang);
}
