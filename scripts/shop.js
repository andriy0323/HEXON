/* ============================================================
   HEXON BETA — Shop
   ============================================================
   The shop has two tabs:

     1. "Скини" — gallery of piece palettes (skins.js). Each card
        shows a 6-colour preview and either:
          - "Користуватися" if the player owns it but it's not equipped,
          - "Активна" (disabled) if the player has it equipped,
          - "Купити N HEX" (with affordability state) otherwise.
        Buying deducts HEX coins, unlocks the skin, and auto-equips it.

     2. "Монети HEX" — 8 fixed bundles. Buying any bundle opens an
        in-game confirmation modal; confirming redirects to the admin's
        Telegram (@PloxoyHard) with a pre-filled order message so the
        player can pay externally. No in-app payments are made.

   The shop UI is rebuilt from scratch every time the screen is entered
   so it always reflects the latest wallet/skins state.
   ============================================================ */
"use strict";

/* HEX-coin bundles. Order matters — UI follows this list top-to-bottom.
   `bonus` is a marketing tag rendered as a ribbon ("+5%", "+10%", …) so
   bigger bundles feel more attractive. No actual coins are deposited
   until the admin confirms the off-app payment. */
const COIN_BUNDLES = [
  { id:"b500",    amount:    500,  bonus:0  },
  { id:"b1000",   amount:   1000,  bonus:0  },
  { id:"b2000",   amount:   2000,  bonus:5  },
  { id:"b5000",   amount:   5000,  bonus:10 },
  { id:"b10000",  amount:  10000,  bonus:15 },
  { id:"b20000",  amount:  20000,  bonus:20 },
  { id:"b50000",  amount:  50000,  bonus:25 },
  { id:"b100000", amount: 100000,  bonus:35 },
];

/* Admin Telegram handle that bundle purchases redirect to. Hard-coded
   per user instructions — change in one place if it ever moves. */
const SHOP_TELEGRAM_HANDLE = "PloxoyHard";

let shopTab = "skins";        // "skins" | "coins"
let pendingBundleId = null;   // bundle awaiting confirmation in #modal-shop-confirm

function openShopScreen(){
  go("shop");
  renderShop();
  try { sfx.shopOpen && sfx.shopOpen(); } catch {}
}

function renderShop(){
  paintShopTabs();
  if(shopTab === "skins") paintSkinGrid();
  else                    paintCoinGrid();
  renderWallet();
}

function paintShopTabs(){
  document.querySelectorAll(".shop-tab").forEach(t => {
    t.classList.toggle("on", t.dataset.tab === shopTab);
  });
  const skinsPane = document.getElementById("shop-pane-skins");
  const coinsPane = document.getElementById("shop-pane-coins");
  if(skinsPane) skinsPane.classList.toggle("hidden", shopTab !== "skins");
  if(coinsPane) coinsPane.classList.toggle("hidden", shopTab !== "coins");
}

/* ---------------- Skins tab ---------------- */
function paintSkinGrid(){
  const grid = document.getElementById("shop-skin-grid");
  if(!grid) return;
  grid.innerHTML = "";
  const equipped = currentSkinId();
  SHOP_SKIN_ORDER.forEach(id => {
    const skin = SKINS[id];
    if(!skin) return;
    const owned = isSkinUnlocked(id);
    const isEquipped = (id === equipped);
    const card = document.createElement("div");
    card.className = "shop-card skin-card" + (isEquipped ? " is-equipped" : owned ? " is-owned" : "");
    card.style.setProperty("--card-accent", skin.accent);

    /* Preview swatch — a 3x2 grid of cells coloured from this skin. */
    const swatch = document.createElement("div");
    swatch.className = "skin-swatch";
    for(let i=0;i<6;i++){
      const cell = document.createElement("div");
      cell.className = "skin-swatch-cell";
      cell.style.background = skin.palette[i] || skin.palette[0];
      swatch.appendChild(cell);
    }

    const name = document.createElement("div");
    name.className = "skin-name";
    name.textContent = skin.name;

    const cta = document.createElement("button");
    cta.className = "btn shop-cta";
    if(isEquipped){
      cta.textContent = (typeof t === "function" ? t("shop.skin.active") : "Active");
      cta.classList.add("btn-ghost");
      cta.disabled = true;
    } else if(owned){
      cta.textContent = (typeof t === "function" ? t("shop.skin.equip") : "Equip");
      cta.classList.add("btn-primary");
      cta.addEventListener("click", () => {
        if(equipSkin(id)){
          saveState();
          try { sfx.shopEquip && sfx.shopEquip(); } catch {}
          toast((typeof t === "function" ? t("shop.skin.equipped", { name: skin.name }) : skin.name + " equipped"), "success");
          renderShop();
        }
      });
    } else {
      const can = getCoins() >= skin.price;
      cta.textContent = formatCoins(skin.price) + " HEX";
      cta.classList.add(can ? "btn-primary" : "btn-disabled");
      cta.disabled = !can;
      cta.addEventListener("click", () => {
        if(!spendCoins(skin.price)){
          toast((typeof t === "function" ? t("shop.skin.poor") : "Not enough HEX"), "warn");
          return;
        }
        unlockSkin(id);
        equipSkin(id);
        saveState();
        try { sfx.shopEquip && sfx.shopEquip(); } catch {}
        toast((typeof t === "function" ? t("shop.skin.bought", { name: skin.name }) : "Bought " + skin.name), "success");
        renderShop();
      });
    }

    card.appendChild(swatch);
    card.appendChild(name);
    card.appendChild(cta);
    grid.appendChild(card);
  });
}

/* ---------------- Coins tab ---------------- */
function paintCoinGrid(){
  const grid = document.getElementById("shop-coin-grid");
  if(!grid) return;
  grid.innerHTML = "";
  COIN_BUNDLES.forEach(b => {
    const card = document.createElement("div");
    card.className = "shop-card coin-card";
    if(b.bonus >= 20) card.classList.add("popular");
    if(b.bonus >= 30) card.classList.add("best-value");

    const stack = document.createElement("div");
    stack.className = "coin-card-stack";
    stack.innerHTML = '<svg viewBox="0 0 24 24" class="coin-card-icon">'
      + '<circle cx="12" cy="12" r="10" fill="url(#coin-grad)" stroke="rgba(255,180,84,.6)" stroke-width="1.2"/>'
      + '<text x="12" y="16" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#0b0f1a">H</text>'
      + '</svg>';

    const amount = document.createElement("div");
    amount.className = "coin-card-amount";
    amount.innerHTML = '<b>' + b.amount.toLocaleString("uk-UA") + '</b> <span>HEX</span>';

    if(b.bonus > 0){
      const ribbon = document.createElement("div");
      ribbon.className = "coin-card-ribbon";
      ribbon.textContent = "+" + b.bonus + "%";
      card.appendChild(ribbon);
    }

    const cta = document.createElement("button");
    cta.className = "btn btn-primary shop-cta";
    cta.innerHTML = '<svg class="ic-svg"><use href="#i-tg"/></svg><span>'
      + (typeof t === "function" ? t("shop.buy") : "Buy")
      + '</span>';
    cta.addEventListener("click", () => openBundleConfirm(b.id));

    card.appendChild(stack);
    card.appendChild(amount);
    card.appendChild(cta);
    grid.appendChild(card);
  });
}

/* ---------------- Bundle purchase flow ---------------- */
function openBundleConfirm(bundleId){
  const b = COIN_BUNDLES.find(x => x.id === bundleId);
  if(!b) return;
  pendingBundleId = bundleId;
  const amountEl = document.getElementById("shop-confirm-amount");
  if(amountEl) amountEl.textContent = b.amount.toLocaleString("uk-UA") + " HEX";
  const idEl = document.getElementById("shop-confirm-id");
  if(idEl) idEl.textContent = (state.profile && state.profile.id) || "—";
  const handleEl = document.getElementById("shop-confirm-handle");
  if(handleEl) handleEl.textContent = "@" + SHOP_TELEGRAM_HANDLE;
  openModal("#modal-shop-confirm");
}

function confirmBundlePurchase(){
  const b = COIN_BUNDLES.find(x => x.id === pendingBundleId);
  closeModal("#modal-shop-confirm");
  if(!b){ pendingBundleId = null; return; }
  const playerId = (state.profile && state.profile.id) || "unknown";
  const nick     = (state.profile && state.profile.nickname) || "Player";
  /* Pre-filled Telegram message so the admin sees exactly what to top up. */
  const msg = "Привіт! Хочу купити " + b.amount.toLocaleString("uk-UA")
            + " HEX за HEXON. Мій ID: " + playerId
            + " (нік: " + nick + ").";
  const url = "https://t.me/" + SHOP_TELEGRAM_HANDLE + "?text=" + encodeURIComponent(msg);
  /* MainActivity intercepts every https:// link and hands it to the
     system browser / Telegram app via ACTION_VIEW. In a normal browser
     this opens a new tab. */
  try { window.open(url, "_blank", "noopener"); }
  catch { window.location.href = url; }
  toast((typeof t === "function" ? t("shop.bundle.redirecting") : "Opening Telegram…"), "info");
  pendingBundleId = null;
}

function cancelBundlePurchase(){
  pendingBundleId = null;
  closeModal("#modal-shop-confirm");
}

/* ---------------- Wiring ---------------- */
function initShopWiring(){
  /* Tab switches. */
  document.querySelectorAll(".shop-tab").forEach(t => {
    t.addEventListener("click", () => {
      shopTab = t.dataset.tab || "skins";
      renderShop();
    });
  });

  /* Daily reward pill on the menu screen. */
  const daily = document.getElementById("daily-reward-pill");
  if(daily){
    daily.addEventListener("click", () => {
      const r = claimDailyReward();
      if(!r.ok){
        toast((typeof t === "function" ? t("daily.not-ready") : "Come back at 11:00"), "warn");
        return;
      }
      try { sfx.coinJackpot && sfx.coinJackpot(); } catch {}
      toast((typeof t === "function"
              ? t("daily.claimed", { n: r.amount })
              : ("+" + r.amount + " HEX")),
            "success");
      if(window.fx && typeof fx.celebrateLevelUp === "function"){
        /* Reuse the level-up confetti for the daily reward — it's a
           celebratory beat too. */
        fx.celebrateLevelUp(r.amount);
      }
      renderWallet();
    });
  }

  /* Bundle confirmation modal. */
  const yes = document.getElementById("shop-confirm-yes");
  const no  = document.getElementById("shop-confirm-no");
  if(yes) yes.addEventListener("click", confirmBundlePurchase);
  if(no)  no.addEventListener("click",  cancelBundlePurchase);
  const back = document.getElementById("modal-shop-confirm");
  if(back) back.addEventListener("click", e => {
    if(e.target.id === "modal-shop-confirm") cancelBundlePurchase();
  });

  /* Menu tile. */
  const tile = document.getElementById("menu-shop");
  if(tile) tile.addEventListener("click", openShopScreen);

  applySkinAccent();
}
