// ============================================================
//  CHARACTER  -  everything about the player's look + profile
// ============================================================
//  Loaded before game.js. Add new customization options here
//  (colors, faces, hats, ...) so game.js doesn't need to change.
//
//  Exposes one global: Character
//    Character.COLORS / FACES / ACCESSORIES   the available options
//    Character.ACC_COLORS                     the colors an accessory can be painted
//    Character.DEFAULT_COLOR / _FACE / _ACCESSORY  fallbacks for bad/missing values
//    Character.color / .face / .accessory     the local player's current choices
//    Character.accColor                       color of the currently chosen accessory
//    Character.faceAlive(color, face, acc, accColor)  SVG string for a living player
//    Character.faceDead(color, acc, accColor)         SVG string for an eliminated player
//    Character.faceHurt(acc, accColor)                SVG string shown when hit
//    Character.sanitize(color, face, acc, accColor)   -> { color, face, accessory, accColor } (valid values only)
//    Character.save()                    store name + look in localStorage
//    Character.init()                    build the profile UI (call once)
//
//  What gets sent to other players: game.js sends { name, color, face, accessory, accColor }.
//  If you add a new option (say "eyebrows"), add it to the join message and the
//  player object in game.js, and draw it in faceAlive() below.
//  New accessories only need an entry in ACCESSORIES (drawn on a 52x52 face):
//  give it a default `color` and an `svg(c)` function that draws it using c.fill / c.stroke.
//  Every accessory remembers its own color, so changing the banana peel to orange
//  doesn't touch the glasses.
// ============================================================

const Character = (() => {
  "use strict";

  const $ = id => document.getElementById(id);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Character colors ----------
  const COLORS = {
    yellow: { fill: "#ffd23f", stroke: "#e08a00" },
    orange: { fill: "#ffa24a", stroke: "#c4600a" },
    pink:   { fill: "#ff9ec4", stroke: "#d6457f" },
    red:    { fill: "#ff6b6b", stroke: "#c22b2b" },
    purple: { fill: "#b98af2", stroke: "#7a3fd0" },
    blue:   { fill: "#7cc4ff", stroke: "#2f82c8" },
    teal:   { fill: "#5fd8c4", stroke: "#1f9a86" },
    green:  { fill: "#8fdc6a", stroke: "#4a9a2a" },
    // skin tones
    skinLight: { fill: "#fbd5b5", stroke: "#d49a6a", label: "light skin", skin: true },
    skinTan:   { fill: "#d99b6c", stroke: "#a2693a", label: "tan skin", skin: true },
    skinDark:  { fill: "#9a6040", stroke: "#5e3620", label: "dark skin", skin: true }
  };
  const DEFAULT_COLOR = "yellow";
  function colorOf(k) { return COLORS[k] || COLORS[DEFAULT_COLOR]; }

  // ---------- Accessory colors (same bright colors, but white / gray / black instead of skin tones) ----------
  const ACC_COLORS = {};
  Object.keys(COLORS).forEach(k => { if (!COLORS[k].skin) ACC_COLORS[k] = COLORS[k]; });
  ACC_COLORS.white = { fill: "#ffffff", stroke: "#a39dae" };
  ACC_COLORS.gray  = { fill: "#9ba1ab", stroke: "#585e68" };
  ACC_COLORS.black = { fill: "#2b2630", stroke: "#0f0c13" };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ---------- Character expressions ----------
  const FACES = {
    smile:  { label: ":)", mouth: '<path d="M14 31 Q26 44 38 31" fill="none" stroke="#3a1a06" stroke-width="3" stroke-linecap="round"/>' },
    sad:    { label: ":(", mouth: '<path d="M15 39 Q26 28 37 39" fill="none" stroke="#3a1a06" stroke-width="3" stroke-linecap="round"/>' },
    tongue: { label: ":P", mouth: '<path d="M25 34 L25 41 Q25 46.5 30.5 46.5 Q36 46.5 36 41 L36 33" fill="#ff7a9c" stroke="#3a1a06" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 31 Q26 38 38 31" fill="none" stroke="#3a1a06" stroke-width="3" stroke-linecap="round"/>' },
    // The tongue's bottom edge is the mouth curve nudged up past the outline, so it never pokes out.
    grin:   { label: ":D", mouth: '<path d="M13 30 Q26 52 39 30 Z" fill="#3a1a06" stroke="#3a1a06" stroke-width="2.4" stroke-linejoin="round"/><path d="M20.5 37.5 Q26 41.5 31.5 37.5 Q26 31.5 20.5 37.5Z" fill="#ff7a9c"/>' }
  };
  const DEFAULT_FACE = "smile";

  // ---------- Character accessories (drawn on top of the face) ----------
  //  color: the accessory's own default color (a key of ACC_COLORS; null = nothing to paint)
  //  svg:   function(c) -> SVG markup, where c = { fill, stroke } of the accessory's current color
  const ACCESSORIES = {
    none:    { label: "None", color: null, svg: () => "" },
    glasses: { label: "Glasses", color: "black", svg: c => {
      const rims = '<circle cx="18" cy="21" r="7.2"/><circle cx="34" cy="21" r="7.2"/>';
      const rest = '<path d="M25.2 20.5 Q26 19.5 26.8 20.5"/><path d="M10.8 20 L4.5 18.5M41.2 20 L47.5 18.5"/>';
      return '<g fill="none" stroke="' + c.stroke + '" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round">' + rims + rest + '</g>' +   // thin outline so any color shows up on any face
        '<g fill="#cfeaff" fill-opacity=".1" stroke="' + c.fill + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + rims + '<g fill="none">' + rest + '</g></g>' +
        '<path d="M13.5 17.5 Q15 16 16.8 15.8M29.5 17.5 Q31 16 32.8 15.8" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>';
    } },
    banana:  { label: "Banana peel", color: "yellow", svg: c => {
      // A peel resting on top of the head: two broad flaps draped over the sides, one curling up in the middle, brown stem cap on top.
      return '<path d="M26 5 C15.6 -4.8 7.4 1.3 4 12 C10.3 9.1 20.2 9.5 26 5Z" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M22 1.6 Q12.2 3.6 5.9 7.4" fill="none" stroke="' + c.stroke + '" stroke-opacity=".5" stroke-width=".9" stroke-linecap="round"/>' +
        '<circle cx="4" cy="12" r="1.5" fill="#7a5320"/>' +
        '<path d="M26 5 C31.8 9.5 42.1 9.2 48 12 C44.2 1.2 36.4 -4.8 26 5Z" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M30 1.6 Q39.8 3.6 46.1 7.4" fill="none" stroke="' + c.stroke + '" stroke-opacity=".5" stroke-width=".9" stroke-linecap="round"/>' +
        '<circle cx="48" cy="12" r="1.5" fill="#7a5320"/>' +
        '<path d="M26 5 C37 0.8 33.9 -5.1 26 -9 C26.1 -4.8 23 0.8 26 5Z" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M29.6 3.3 Q30.4 -2.7 29 -7" fill="none" stroke="' + c.stroke + '" stroke-opacity=".5" stroke-width=".9" stroke-linecap="round"/>' +
        '<circle cx="26" cy="-9" r="1.5" fill="#7a5320"/>' +
        '<rect x="22.5" y="1" width="7" height="5.5" rx="2.2" fill="#7a5320"/>';
    } }
  };
  const DEFAULT_ACCESSORY = "none";
  const accDef = a => has(ACCESSORIES, a) ? ACCESSORIES[a] : ACCESSORIES[DEFAULT_ACCESSORY];
  // Color to paint accessory `a` in: the given key if valid, otherwise that accessory's own default
  const accColorOf = (a, ck) => ACC_COLORS[has(ACC_COLORS, ck) ? ck : accDef(a).color] || ACC_COLORS.black;
  const accOf = (a, ck) => accDef(a).svg(accColorOf(a, ck));

  // The local player's current choices (restored from localStorage)
  let myColor = DEFAULT_COLOR, myFace = DEFAULT_FACE, myAcc = DEFAULT_ACCESSORY;
  try { const sc = localStorage.getItem("pp-color"); if (has(COLORS, sc)) myColor = sc; } catch (e) {}
  try { const sf = localStorage.getItem("pp-face"); if (has(FACES, sf)) myFace = sf; } catch (e) {}
  try { const sa = localStorage.getItem("pp-accessory"); if (has(ACCESSORIES, sa)) myAcc = sa; } catch (e) {}
  // Each accessory remembers its own color. Only colors the player changed are stored;
  // anything missing falls back to that accessory's default (glasses black, banana peel yellow).
  const myAccColors = {};
  try {
    const sc = JSON.parse(localStorage.getItem("pp-acc-colors"));
    if (sc && typeof sc === "object") Object.keys(sc).forEach(a => { if (has(ACCESSORIES, a) && ACCESSORIES[a].color && has(ACC_COLORS, sc[a])) myAccColors[a] = sc[a]; });
  } catch (e) {}
  const accColorKey = a => has(myAccColors, a) ? myAccColors[a] : ACCESSORIES[a].color;

  // ---------- Face drawings ----------
  const faceAlive = (k, f, a, ac) => { const c = colorOf(k), fc = FACES[f] || FACES[DEFAULT_FACE]; return '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="2"/><circle cx="18" cy="21" r="3.2" fill="#3a1a06"/><circle cx="34" cy="21" r="3.2" fill="#3a1a06"/>' + fc.mouth + accOf(a, ac) + '</svg>'; };
  const faceDead = (k, a, ac) => { const c = colorOf(k); return '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="2"/><path d="M14 17l8 8M22 17l-8 8M30 17l8 8M38 17l-8 8" stroke="#3a1a06" stroke-width="2.6" stroke-linecap="round"/><path d="M17 36 Q26 30 35 36" fill="none" stroke="#3a1a06" stroke-width="3" stroke-linecap="round"/>' + accOf(a, ac) + '</svg>'; };

  const faceHurt = (a, ac) => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="#ff8a5c" stroke="#e08a00" stroke-width="2"/><path d="M13 17l9 4-9 4M39 17l-9 4 9 4" fill="none" stroke="#3a1a06" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 38 Q21 31 26 38 Q31 31 36 38" fill="none" stroke="#3a1a06" stroke-width="2.6" stroke-linecap="round"/>' + accOf(a, ac) + '</svg>';
  const FACE_HURT = faceHurt(DEFAULT_ACCESSORY);

  function sanitize(color, face, accessory, accColor) {
    const acc = has(ACCESSORIES, accessory) ? accessory : DEFAULT_ACCESSORY;
    return {
      color: has(COLORS, color) ? color : DEFAULT_COLOR,
      face: has(FACES, face) ? face : DEFAULT_FACE,
      accessory: acc,
      accColor: has(ACC_COLORS, accColor) ? accColor : ACCESSORIES[acc].color
    };
  }

  // ---------- Profile (name + character) ----------
  function saveProfile() { try { localStorage.setItem("pp-name", $("nameInput").value); localStorage.setItem("pp-color", myColor); localStorage.setItem("pp-face", myFace); localStorage.setItem("pp-accessory", myAcc); localStorage.setItem("pp-acc-colors", JSON.stringify(myAccColors)); } catch (e) {} }
  function renderProfile() {
    const curAccColor = accColorKey(myAcc);
    $("facePreview").innerHTML = faceAlive(myColor, myFace, myAcc, curAccColor);
    $("faceOpts").querySelectorAll(".facebtn").forEach(b => { b.setAttribute("aria-checked", b.dataset.k === myFace ? "true" : "false"); b.innerHTML = faceAlive(myColor, b.dataset.k, myAcc, curAccColor); });
    // each accessory button is drawn in its own remembered color
    $("accOpts").querySelectorAll(".facebtn").forEach(b => { b.setAttribute("aria-checked", b.dataset.k === myAcc ? "true" : "false"); b.innerHTML = faceAlive(myColor, myFace, b.dataset.k, accColorKey(b.dataset.k)); });
    $("swatches").querySelectorAll(".swatch").forEach(b => b.setAttribute("aria-checked", b.dataset.k === myColor ? "true" : "false"));
    // "None" has nothing to paint, so its color row is switched off
    const canPaint = !!ACCESSORIES[myAcc].color;
    $("accSwatches").querySelectorAll(".swatch").forEach(b => { b.disabled = !canPaint; b.setAttribute("aria-checked", canPaint && b.dataset.k === curAccColor ? "true" : "false"); });
  }
  function selectTab(tab) {
    document.querySelectorAll("#profileTabs [role=tab]").forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).classList.toggle("hidden", !on);
    });
  }
  function makeSwatches(box, palette, onPick) {
    Object.keys(palette).forEach(k => {
      const label = palette[k].label || k;
      const b = el("button", "swatch"); b.type = "button"; b.dataset.k = k; b.title = label;
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", label);
      b.style.background = palette[k].fill;
      b.onclick = () => { onPick(k); saveProfile(); renderProfile(); };
      box.appendChild(b);
    });
  }
  function init() {
    makeSwatches($("swatches"), COLORS, k => { myColor = k; });
    makeSwatches($("accSwatches"), ACC_COLORS, k => { if (ACCESSORIES[myAcc].color) myAccColors[myAcc] = k; });
    Object.keys(FACES).forEach(k => {
      const b = el("button", "facebtn"); b.type = "button"; b.dataset.k = k; b.title = FACES[k].label;
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", FACES[k].label);
      b.onclick = () => { myFace = k; saveProfile(); renderProfile(); };
      $("faceOpts").appendChild(b);
    });
    Object.keys(ACCESSORIES).forEach(k => {
      const wrap = el("div", "accopt");
      const b = el("button", "facebtn"); b.type = "button"; b.dataset.k = k; b.title = ACCESSORIES[k].label;
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", ACCESSORIES[k].label);
      b.onclick = () => { myAcc = k; saveProfile(); renderProfile(); };
      wrap.appendChild(b); wrap.appendChild(el("span", "acclabel", ACCESSORIES[k].label));
      $("accOpts").appendChild(wrap);
    });
    const tabs = Array.from(document.querySelectorAll("#profileTabs [role=tab]"));
    tabs.forEach((t, i) => {
      t.onclick = () => selectTab(t);
      t.addEventListener("keydown", e => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length];
        selectTab(n); n.focus();
      });
    });
    selectTab(tabs[0]);
    try { const sn = localStorage.getItem("pp-name"); if (sn) $("nameInput").value = sn; } catch (e) {}
    $("nameInput").addEventListener("input", saveProfile);
    renderProfile();
  }

  // Profile UI is built once the page is ready (game.js calls Character.init())
  return {
    COLORS, ACC_COLORS, FACES, ACCESSORIES, DEFAULT_COLOR, DEFAULT_FACE, DEFAULT_ACCESSORY, FACE_HURT,
    get color() { return myColor; },
    get face() { return myFace; },
    get accessory() { return myAcc; },
    get accColor() { return accColorKey(myAcc); },
    colorOf, faceAlive, faceDead, faceHurt, sanitize,
    save: saveProfile,
    render: renderProfile,
    init
  };
})();
