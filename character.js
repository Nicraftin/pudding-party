// ============================================================
//  CHARACTER  -  everything about the player's look + profile
// ============================================================
//  Loaded before game.js. Add new customization options here
//  (colors, faces, hats, ...) so game.js doesn't need to change.
//
//  Exposes one global: Character
//    Character.COLORS / FACES / ACCESSORIES   the available options
//    Character.DEFAULT_COLOR / _FACE / _ACCESSORY  fallbacks for bad/missing values
//    Character.color / .face / .accessory     the local player's current choices
//    Character.faceAlive(color, face, acc)    SVG string for a living player
//    Character.faceDead(color, acc)           SVG string for an eliminated player
//    Character.faceHurt(acc)                  SVG string shown when hit
//    Character.sanitize(color, face, acc)     -> { color, face, accessory } (valid values only)
//    Character.save()                    store name + look in localStorage
//    Character.init()                    build the profile UI (call once)
//
//  What gets sent to other players: game.js sends { name, color, face, accessory }.
//  If you add a new option (say "hat"), add it to the join message and the
//  player object in game.js, and draw it in faceAlive() below.
//  New accessories only need an entry in ACCESSORIES (drawn on a 52x52 face).
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
  const ACCESSORIES = {
    none:    { label: "None", svg: "" },
    glasses: { label: "Glasses", svg: '<g fill="#cfeaff" fill-opacity=".1" stroke="#2b2630" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><circle cx="18" cy="21" r="7.2"/><circle cx="34" cy="21" r="7.2"/><path d="M25.2 20.5 Q26 19.5 26.8 20.5" fill="none"/><path d="M10.8 20 L4.5 18.5M41.2 20 L47.5 18.5" fill="none"/></g><path d="M13.5 17.5 Q15 16 16.8 15.8M29.5 17.5 Q31 16 32.8 15.8" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>' }
  };
  const DEFAULT_ACCESSORY = "none";
  const accOf = a => (ACCESSORIES[a] || ACCESSORIES[DEFAULT_ACCESSORY]).svg;

  // The local player's current choices (restored from localStorage)
  let myColor = DEFAULT_COLOR, myFace = DEFAULT_FACE, myAcc = DEFAULT_ACCESSORY;
  try { const sc = localStorage.getItem("pp-color"); if (COLORS[sc]) myColor = sc; } catch (e) {}
  try { const sf = localStorage.getItem("pp-face"); if (FACES[sf]) myFace = sf; } catch (e) {}
  try { const sa = localStorage.getItem("pp-accessory"); if (ACCESSORIES[sa]) myAcc = sa; } catch (e) {}

  // ---------- Face drawings ----------
  const faceAlive = (k, f, a) => { const c = colorOf(k), fc = FACES[f] || FACES[DEFAULT_FACE]; return '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="2"/><circle cx="18" cy="21" r="3.2" fill="#3a1a06"/><circle cx="34" cy="21" r="3.2" fill="#3a1a06"/>' + fc.mouth + accOf(a) + '</svg>'; };
  const faceDead = (k, a) => { const c = colorOf(k); return '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="2"/><path d="M14 17l8 8M22 17l-8 8M30 17l8 8M38 17l-8 8" stroke="#3a1a06" stroke-width="2.6" stroke-linecap="round"/><path d="M17 36 Q26 30 35 36" fill="none" stroke="#3a1a06" stroke-width="3" stroke-linecap="round"/>' + accOf(a) + '</svg>'; };

  const faceHurt = a => '<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="#ff8a5c" stroke="#e08a00" stroke-width="2"/><path d="M13 17l9 4-9 4M39 17l-9 4 9 4" fill="none" stroke="#3a1a06" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 38 Q21 31 26 38 Q31 31 36 38" fill="none" stroke="#3a1a06" stroke-width="2.6" stroke-linecap="round"/>' + accOf(a) + '</svg>';
  const FACE_HURT = faceHurt(DEFAULT_ACCESSORY);

  function sanitize(color, face, accessory) {
    return { color: COLORS[color] ? color : DEFAULT_COLOR, face: FACES[face] ? face : DEFAULT_FACE, accessory: ACCESSORIES[accessory] ? accessory : DEFAULT_ACCESSORY };
  }

  // ---------- Profile (name + character) ----------
  function saveProfile() { try { localStorage.setItem("pp-name", $("nameInput").value); localStorage.setItem("pp-color", myColor); localStorage.setItem("pp-face", myFace); localStorage.setItem("pp-accessory", myAcc); } catch (e) {} }
  function renderProfile() {
    $("facePreview").innerHTML = faceAlive(myColor, myFace, myAcc);
    $("faceOpts").querySelectorAll(".facebtn").forEach(b => { b.setAttribute("aria-checked", b.dataset.k === myFace ? "true" : "false"); b.innerHTML = faceAlive(myColor, b.dataset.k, myAcc); });
    $("accOpts").querySelectorAll(".facebtn").forEach(b => { b.setAttribute("aria-checked", b.dataset.k === myAcc ? "true" : "false"); b.innerHTML = faceAlive(myColor, myFace, b.dataset.k); });
    $("swatches").querySelectorAll(".swatch").forEach(b => b.setAttribute("aria-checked", b.dataset.k === myColor ? "true" : "false"));
  }
  function selectTab(tab) {
    document.querySelectorAll("#profileTabs [role=tab]").forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).classList.toggle("hidden", !on);
    });
  }
  function init() {
    let prevSkin = false;
    Object.keys(COLORS).forEach(k => {
      const label = COLORS[k].label || k;
      if (COLORS[k].skin && !prevSkin) $("swatches").appendChild(el("span", "swatchbreak")); // skin tones get their own row
      prevSkin = !!COLORS[k].skin;
      const b = el("button", "swatch"); b.type = "button"; b.dataset.k = k; b.title = label;
      b.setAttribute("role", "radio"); b.setAttribute("aria-label", label);
      b.style.background = COLORS[k].fill;
      b.onclick = () => { myColor = k; saveProfile(); renderProfile(); };
      $("swatches").appendChild(b);
    });
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
    COLORS, FACES, ACCESSORIES, DEFAULT_COLOR, DEFAULT_FACE, DEFAULT_ACCESSORY, FACE_HURT,
    get color() { return myColor; },
    get face() { return myFace; },
    get accessory() { return myAcc; },
    colorOf, faceAlive, faceDead, faceHurt, sanitize,
    save: saveProfile,
    render: renderProfile,
    init
  };
})();
