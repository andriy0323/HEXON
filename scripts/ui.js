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
  const nickCount = $("#nick-count");
  if (state.profile.nickname) {
    nickInput.value = state.profile.nickname;
    nickCount.textContent = state.profile.nickname.length + "/20";
  }
  nickInput.addEventListener("input", () => {
    nickCount.textContent = nickInput.value.length + "/20";
  });
  $("#login-confirm").addEventListener("click", () => {
    const name = (nickInput.value || "").trim() || "Player";
    state.profile.nickname = name.slice(0, 20);
    /* IDs are issued exactly once per install — see init() for the
       permanent-key mirror that also survives reset. */
    if (!state.profile.id) state.profile.id = genId();
    if (typeof savePermanentPlayerId === "function") savePermanentPlayerId(state.profile.id);
    if (!state.profile.registeredAt) state.profile.registeredAt = Date.now();
    registerLoginDay();
    saveState();
    enterApp();
    toast(t("toast.welcome", { name: state.profile.nickname }), "success");
  });
  nickInput.addEventListener("keydown", e => { if (e.key === "Enter") $("#login-confirm").click(); });

  // auto-resume if already registered
  if (state.profile.nickname && state.profile.id) {
    registerLoginDay();
    enterApp();
  } else {
    showLogin();
  }
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
    /* "Sign out" clears the nickname so the login screen shows again,
       but the permanent HEXON ID is preserved (mirror key) so the
       player keeps their identity. */
    state.profile.nickname = "";
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
