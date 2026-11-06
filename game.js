(() => {
  "use strict";

  const PREFIX = "puddingparty-";
  const ANNOUNCE_MS = 5000;
  const LOBBY_MS = 15000;
  const DEFAULT_LIFE_PTS = 500;
  const PUD_MAX_R = 10; // % of wheel the pudding can drift toward the current player
  const DEFAULT_LIVES = 3, DEFAULT_SECS = 15;
  const MAX_RING = 8, MAX_PEOPLE = 16, OVER_MS = 5000, IMPACT_MS = 450, HIT_MS = 1500, EAT_MS = 2300; // HIT/EAT match the CSS animation lengths
  const VOTE_MS = 20000;
  const HOLD_MS = 1800; // pause before switching prompts so everyone can see the last answer
  const RETURN_MS = 1000, JOIN_MS = 500, SLIDE_MS = 450; // RETURN_MS: slow glide back to centre after the final chomp; JOIN_MS matches the joinFade CSS animation
  const CHEW_END = 1500, CHEW_END_FINALE = 1900; // when the pudding stops chewing and starts heading back to the centre

  // ---------- Rarities ----------
  const RARITIES = {
    spoon: { name: "Spoon",       pts: 10,  color: "#b8bcc4" },
    slice: { name: "Slice",       pts: 30,  color: "#8fd3ff" },
    rare:  { name: "Rare",        pts: 60,  color: "#ff6a6a" },
    deep:  { name: "Deep Cut",    pts: 85,  color: "#b98af2" },
    flan:  { name: "Flan-tastic", pts: 120, color: "#ffd23f" }
  };
  const ICONS = {
    spoon: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="7.5" rx="4.2" ry="5.5" fill="#6b6f78"/><rect x="10.8" y="12" width="2.4" height="10" rx="1.2" fill="#6b6f78"/></svg>',
    slice: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="18" rx="10.5" ry="4" fill="#4aa8e0"/><ellipse cx="12" cy="17.4" rx="8.5" ry="2.8" fill="#bfe6ff"/><path d="M5.5 16.5 L9 7.5 Q12 6 15 7.5 L18.5 16.5 Q12 19 5.5 16.5Z" fill="#ffd98a" stroke="#c8921a" stroke-width="1"/><path d="M9 7.5 Q12 6 15 7.5 L15.7 9.6 Q12 8.6 8.3 9.6Z" fill="#8a4a12"/></svg>',
    rare:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 14 Q10 6 15 3 M16 15 Q16 8 15 3" fill="none" stroke="#2f7a2f" stroke-width="1.6" stroke-linecap="round"/><path d="M15 3 Q19 2 21 5 Q17 6 15 3Z" fill="#3fa03f"/><circle cx="8" cy="17.5" r="4.6" fill="#d62d2d"/><circle cx="16.5" cy="18" r="4.6" fill="#d62d2d"/><circle cx="6.6" cy="16" r="1.2" fill="#ff9a9a"/><circle cx="15" cy="16.4" r="1.2" fill="#ff9a9a"/></svg>',
    deep:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 Q17 6 14.6 13.5 H10 Q9 6 12 1Z" fill="#e3e6ea" stroke="#8d939c" stroke-width="1"/><rect x="9.6" y="13.5" width="5" height="9" rx="1.8" fill="#7a3fd0"/><rect x="9.6" y="13.5" width="5" height="1.6" fill="#4d238f"/></svg>',
    flan:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 21 L6.8 9 Q12 7 17.2 9 L19.5 21 Q12 23 4.5 21Z" fill="#ffcf3a" stroke="#b8860b" stroke-width="1.2"/><path d="M6.8 9 Q12 7 17.2 9 L17.7 11.6 Q12 10.4 6.3 11.6Z" fill="#a05a10"/><path d="M12 1.5 L13 4 L15.6 4.3 L13.6 6 L14.2 8.5 L12 7.2 L9.8 8.5 L10.4 6 L8.4 4.3 L11 4Z" fill="#fff3a0" stroke="#d9a400" stroke-width=".6"/></svg>'
  };

  // ---------- Sound effects (files are optional: missing files just play nothing) ----------
  const SFX_NAMES = ["eat", "damage", "flantastic", "answer", "invalid", "extralife", "newprompt", "win"];
  const sfx = {};
  let sfxVol = 0.8;
  try { const sv = parseFloat(localStorage.getItem("pp-sfx-volume")); if (!isNaN(sv)) sfxVol = Math.min(1, Math.max(0, sv)); } catch (e) {}
  SFX_NAMES.forEach(n => {
    const o = sfx[n] = { a: null, missing: false };
    try {
      const a = new Audio(); a.preload = "auto";
      a.addEventListener("error", () => { o.missing = true; });
      a.src = n + ".ogg"; o.a = a;
    } catch (e) { o.missing = true; }
  });
  function playSfx(n) {
    const o = sfx[n];
    if (!o || o.missing || !o.a || sfxVol <= 0) return;
    try {
      const c = o.a.cloneNode(); c.volume = sfxVol;
      const p = c.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function winMs() { // the win animation lasts exactly as long as win.ogg
    const o = sfx.win, d = o && o.a && o.a.duration;
    return (!o || o.missing || !isFinite(d) || d <= 0) ? OVER_MS : Math.round(d * 1000);
  }
  function syncSfxSliders() {
    document.querySelectorAll(".sfxVol").forEach(s => {
      s.value = Math.round(sfxVol * 100);
      const pct = s.parentNode.querySelector(".sfxpct"); if (pct) pct.textContent = Math.round(sfxVol * 100) + "%";
    });
  }
  function initSfxSliders() {
    syncSfxSliders();
    document.querySelectorAll(".sfxVol").forEach(s => {
      s.addEventListener("input", () => {
        sfxVol = Math.min(1, Math.max(0, (parseInt(s.value, 10) || 0) / 100));
        try { localStorage.setItem("pp-sfx-volume", String(sfxVol)); } catch (e) {}
        syncSfxSliders();
      });
      s.addEventListener("change", () => playSfx("answer")); // preview at the new volume
    });
  }

  // ---------- Character (colors, faces, profile UI live in character.js) ----------
  const { faceAlive, faceDead, faceHurt } = Character;

  // ---------- Modes ----------
  const MODES = { sulka: "Sulka", social: "Social Craft" };

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  function show(name) { if (name !== "game") { const h = document.querySelector("main > h1"); if (h) h.classList.add("hidden"); } $("home").classList.toggle("hidden", name !== "home"); $("gameLayout").classList.toggle("hidden", name !== "game"); $("profile").classList.toggle("hidden", name !== "home"); }
  let toastTimer;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Network state ----------
  let peer = null, isHost = false, myId = null, myName = "";
  let hostConn = null;            // guest -> host connection
  const conns = {};               // host: peerId -> DataConnection
  let state = null;               // latest game state
  let localDeadline = 0;
  let look = null, lastTick = Date.now();
  const pud = { x: 0, y: 0 };
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let roomCode = "";

  // Host-only
  let holdTimer = null, voteTimer = null, skipTimer = null, turnTimer = null, announceTimer = null, lobbyTimer = null, attackTimer = null, overTimer = null;
  let migrateTimer = null, graceTimer = null, migrating = false, claimPending = false;
  let localStart = 0;            // when the lobby countdown ends (0 = not counting)
  let seenAnswer = {};            // playerId -> id of the last answer we already showed a particle for

  function randCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let c = ""; for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }
  function cleanName(n) { return (n || "").trim().slice(0, 16) || "Player" + Math.floor(Math.random() * 90 + 10); }

  function clampInt(v, lo, hi, def) {
    const n = parseInt(v, 10);
    return isNaN(n) ? def : Math.min(hi, Math.max(lo, n));
  }

  function teardown() {
    clearTimeout(turnTimer); clearTimeout(announceTimer); clearTimeout(lobbyTimer); clearTimeout(holdTimer);
    lobbyTimer = null; localStart = 0; $("answerInput").value = ""; $("dym").classList.add("hidden");
    try { peer && peer.destroy(); } catch (e) {}
    peer = null; hostConn = null; state = null; isHost = false; myId = null; seenAnswer = {}; ringSeen = null; seatMove = {};
    document.querySelectorAll(".particle").forEach(p => p.remove());
    Object.keys(conns).forEach(k => delete conns[k]);
    clearTimeout(migrateTimer); clearTimeout(graceTimer); migrating = false; claimPending = false;
    clearTimeout(attackTimer); clearTimeout(overTimer); clearTimeout(voteTimer); clearTimeout(skipTimer); attackLocal = null; lastAttackSeq = 0; lastWinSeq = 0; lifeSeen = null; lastRoundSeq = 0;
    document.querySelectorAll(".dmg,.confetti,.fx").forEach(p => p.remove());
    show("home");
  }

  // ---------- Create lobby (host) ----------
  function createLobby(attempt = 0) {
    myName = cleanName($("nameInput").value);
    Character.save();
    roomCode = randCode();
    isHost = true;
    const lives = DEFAULT_LIVES, secs = DEFAULT_SECS;
    peer = new Peer(PREFIX + roomCode);
    peer.on("open", id => {
      myId = id;
      state = {
        phase: "lobby",
        code: roomCode, hostId: myId,
        settings: { lives, turnMs: secs * 1000, lifePts: DEFAULT_LIFE_PTS, mode: "sulka" },
        players: [{ id: myId, name: myName, color: Character.color, face: Character.face, accessory: Character.accessory, accColor: Character.accColor, lives, alive: true, inRing: false, inMatch: false, pts: 0, segs: [], last: null }],
        answerSeq: 0, vote: null, skip: null, typing: "", announcing: false, attack: null,
        turn: null, prompt: null, sub: null, used: [], event: "", winner: null, remaining: 0
      };
      broadcast();
      render();
    });
    attachHostHandlers(peer);
    peer.on("error", err => {
      if (err.type === "unavailable-id" && attempt < 5) {
        try { peer.destroy(); } catch (e) {}
        createLobby(attempt + 1);
      } else {
        toast("Connection problem: " + err.type);
        teardown();
      }
    });
  }

  function attachHostHandlers(p) {
    p.on("connection", conn => {
      const gone = () => { if (conns[conn.peer] === conn) onGuestLeft(conn.peer); }; // ignore stale connections replaced by a reconnect
      conn.on("data", msg => onHostMessage(conn, msg));
      conn.on("close", gone);
      conn.on("error", gone);
    });
  }

  // ---------- Join lobby (guest) ----------
  function joinLobby() {
    const code = $("codeInput").value.trim().toUpperCase();
    if (code.length !== 4) { toast("Enter the 4-letter lobby code"); return; }
    myName = cleanName($("nameInput").value);
    Character.save();
    roomCode = code;
    isHost = false;
    peer = new Peer();
    peer.on("open", id => { myId = id; if (!hostConn) connectToHost(); });
    peer.on("error", err => {
      if (migrating) return; // the migration loop keeps retrying
      toast(err.type === "peer-unavailable" ? "No lobby with that code" : "Connection problem: " + err.type);
      teardown();
    });
  }

  function connectToHost() {
    const conn = peer.connect(PREFIX + roomCode, { reliable: true });
    hostConn = conn;
    conn.on("open", () => {
      if (conn !== hostConn) return;
      migrating = false; clearTimeout(migrateTimer);
      conn.send({ t: "join", name: myName, color: Character.color, face: Character.face, accessory: Character.accessory, accColor: Character.accColor });
    });
    conn.on("data", msg => {
      if (conn !== hostConn) return;
      if (msg.t === "state") {
        state = msg.state;
        if (state.remap) applyRemap(state.remap.from, state.remap.to);
        localDeadline = Date.now() + state.remaining;
        localStart = state.startIn != null ? Date.now() + state.startIn : 0;
        render();
      } else if (msg.t === "reject") {
        toast(msg.reason);
        teardown();
      } else if (msg.t === "msg") {
        toast(msg.text);
        if (msg.shake) shakeInput();
      } else if (msg.t === "suggest") {
        showSuggestion(msg.text);
      } else if (msg.t === "typing") {
        if (state) { state.typing = msg.text; updateBubbles(); }
      }
    });
    conn.on("close", () => { if (conn === hostConn) onHostLost(); });
    conn.on("error", () => { if (conn === hostConn) onHostLost(); });
  }

  // ---------- Host migration ----------
  function applyRemap(from, to) { // a player's id changed (the new host took over the room's peer id): keep their local animation state
    [seenAnswer, ringSeen, seatMove].forEach(o => { if (o && from in o && !(to in o)) { o[to] = o[from]; delete o[from]; } });
  }

  function onHostLost() {
    if (migrating) return;
    const oldHost = state && state.hostId;
    const cands = state ? state.players.filter(p => p.id !== oldHost && !p.left) : [];
    const idx = cands.findIndex(p => p.id === myId);
    if (!peer || isHost || idx < 0) { toast("Host disconnected"); teardown(); return; }
    migrating = true; claimPending = false;
    toast("The host left, passing the host role on…");
    const t0 = Date.now();
    let joinAt = 0;
    const step = () => {
      if (!migrating || !peer || isHost) return;
      const elapsed = Date.now() - t0;
      if (elapsed > 30000) { toast("Couldn't find a new host"); teardown(); return; }
      if (elapsed >= idx * 3500 && !claimPending) claimHost(oldHost);
      else if (!(hostConn && hostConn.open) && (!hostConn || Date.now() - joinAt > 3000)) {
        const old = hostConn; hostConn = null;
        try { old && old.close(); } catch (e) {}
        joinAt = Date.now();
        connectToHost();
      }
      migrateTimer = setTimeout(step, 1000);
    };
    step();
  }

  function claimHost(oldHost) { // first remaining player grabs the room code's peer id and becomes the host
    claimPending = true;
    const np = new Peer(PREFIX + roomCode);
    let claimed = false;
    np.on("open", id => {
      if (!migrating || !peer) { try { np.destroy(); } catch (e) {} return; }
      claimed = true;
      const oldPeer = peer, oldId = myId;
      clearTimeout(migrateTimer); migrating = false; claimPending = false;
      hostConn = null; peer = np; myId = id; isHost = true;
      try { oldPeer.destroy(); } catch (e) {}
      attachHostHandlers(np);
      takeOver(oldId, oldHost);
    });
    np.on("error", err => {
      if (!claimed) { claimPending = false; try { np.destroy(); } catch (e) {} return; } // someone else got there first (or the old id isn't released yet): the loop retries
      toast("Connection problem: " + err.type); teardown();
    });
  }

  function takeOver(oldId, oldHost) {
    state = JSON.parse(JSON.stringify(state).split('"' + oldId + '"').join('"' + myId + '"')); // my player id is now the room's peer id
    if (oldHost === oldId) oldHost = myId;
    applyRemap(oldId, myId);
    state.hostId = myId; state.remap = { from: oldId, to: myId };
    state.typing = "";
    // restart the timers the old host was running
    if (state.phase === "lobby") { localStart = 0; checkLobbyStart(); }
    else if (state.phase === "game") {
      if (state.vote) { state.vote = null; state.event = "Vote cancelled"; }
      if (state.skip) { state.skip = null; state.event = "Vote cancelled"; }
      const at = state.attack;
      if (at) {
        const p = state.players.find(x => x.id === at.id);
        if (p && p.alive && state.event === p.name + " ran out of time!") { // the bite hadn't landed yet
          p.lives = Math.max(0, p.lives - 1);
          state.lossIds = state.lossIds || []; if (!state.lossIds.includes(p.id)) state.lossIds.push(p.id);
          if (at.kill) { p.alive = false; p.inRing = false; p.eaten = true; state.event = "The pudding ate " + p.name + "!"; }
          else state.event = p.name + " lost a life";
        }
        state.attack = null;
        afterElimination();
      } else if (state.holding) { state.holding = false; newRound(); announceRound(); }
      else if (state.announcing) announceRound();
      else turnTimer = setTimeout(onTimeout, Math.max(300, localDeadline - Date.now()));
    } else if (state.phase === "over") overTimer = setTimeout(backToLobby, 3000);
    toast("You're the host now");
    if (oldHost) onGuestLeft(oldHost);
    // anyone who never reconnects is treated as having left
    clearTimeout(graceTimer);
    graceTimer = setTimeout(() => {
      if (!isHost || !state) return;
      state.players.filter(p => p.id !== myId && !(conns[p.id] && conns[p.id].open)).map(p => p.id).forEach(onGuestLeft);
    }, 15000);
    broadcast(); render();
  }

  // ---------- Host: message handling ----------
  function onHostMessage(conn, msg) {
    if (msg.t === "join") {
      const known = state.players.find(p => p.id === conn.peer);
      if (!known && state.players.length >= MAX_PEOPLE) { conn.send({ t: "reject", reason: "Lobby is full" }); return; }
      conns[conn.peer] = conn;
      if (!known) {
        const look = Character.sanitize(msg.color, msg.face, msg.accessory, msg.accColor);
        state.players.push({ id: conn.peer, name: cleanName(msg.name), color: look.color, face: look.face, accessory: look.accessory, accColor: look.accColor, lives: state.settings.lives, alive: true, inRing: false, inMatch: false, pts: 0, segs: [], last: null });
      }
      checkLobbyStart();
      broadcast(); render();
    } else if (msg.t === "typing") {
      if (state.phase !== "game" || state.announcing || state.holding || state.turn !== conn.peer) return;
      state.typing = String(msg.text || "");
      relayTyping(conn.peer); updateBubbles();
    } else if (msg.t === "ring") {
      setRing(conn.peer, !!msg.on);
    } else if (msg.t === "answer") {
      submitAnswer(conn.peer, String(msg.text || ""));
    } else if (msg.t === "callVote") {
      callVote(conn.peer, String(msg.target || ""));
    } else if (msg.t === "vote") {
      castVote(conn.peer, !!msg.yes);
    } else if (msg.t === "callSkip") {
      callSkip(conn.peer);
    } else if (msg.t === "skipVote") {
      castSkip(conn.peer, !!msg.yes);
    }
  }

  // ---------- Host: extra-life votes ----------
  function callVote(callerId, targetId) {
    if (!state || state.phase !== "game") return;
    if (state.vote) { tell(callerId, "A vote is already in progress"); return; }
    const caller = state.players.find(p => p.id === callerId), target = state.players.find(p => p.id === targetId);
    if (!caller || !caller.inMatch || !caller.alive) { tell(callerId, "Only players still in the match can call a vote"); return; }
    if (!target || !target.inMatch || !target.alive) { tell(callerId, "That player can't get an extra life"); return; }
    const voters = state.players.filter(p => p.inMatch && p.alive).map(p => p.id); // everyone in the match, including the player receiving the life
    if (!voters.length) return;
    state.voteSeq = (state.voteSeq || 0) + 1;
    state.vote = { seq: state.voteSeq, caller: callerId, callerName: caller.name, target: targetId, targetName: target.name, voters, yes: voters.includes(callerId) ? [callerId] : [] };
    state.event = caller.name + " called a vote: extra life for " + target.name;
    clearTimeout(voteTimer); voteTimer = setTimeout(() => endVote(false, "The vote timed out"), VOTE_MS);
    if (!resolveVote()) { state.vote.remainingMs = VOTE_MS; broadcast(); render(); }
  }
  function castVote(id, yes) {
    const v = state && state.vote; if (!v || !v.voters.includes(id) || v.yes.includes(id)) return;
    if (!yes) { const p = state.players.find(x => x.id === id); endVote(false, (p ? p.name : "Someone") + " declined the extra life vote"); return; }
    v.yes.push(id);
    if (!resolveVote()) { broadcast(); render(); }
  }
  function resolveVote() { // pass the vote once every eligible voter agrees
    const v = state && state.vote; if (!v) return false;
    v.voters = v.voters.filter(id => { const p = state.players.find(x => x.id === id); return p && p.inMatch && p.alive; });
    v.yes = v.yes.filter(id => v.voters.includes(id));
    const t = state.players.find(p => p.id === v.target);
    if (!t || !t.alive) { endVote(false, "Vote cancelled"); return true; }
    if (v.voters.every(id => v.yes.includes(id))) { t.lives++; state.lifeSeq = (state.lifeSeq || 0) + 1; endVote(true, v.targetName + " got an extra life!"); return true; }
    return false;
  }
  function endVote(passed, text) {
    clearTimeout(voteTimer); voteTimer = null;
    if (!state) return;
    state.vote = null;
    if (text) state.event = text;
    broadcast(); render();
  }

  // ---------- Host: skip-prompt votes ----------
  function callSkip(callerId) {
    if (!state || state.phase !== "game") return;
    if (state.skip) { tell(callerId, "A skip vote is already in progress"); return; }
    if (state.attack || state.holding) { tell(callerId, "Can't skip right now"); return; }
    const caller = state.players.find(p => p.id === callerId);
    if (!caller || !caller.inMatch || !caller.alive) { tell(callerId, "Only players still in the match can call a vote"); return; }
    const voters = state.players.filter(p => p.inMatch && p.alive).map(p => p.id);
    state.skipSeq = (state.skipSeq || 0) + 1;
    state.skip = { seq: state.skipSeq, caller: callerId, callerName: caller.name, round: state.roundSeq, voters, yes: [callerId] };
    state.event = caller.name + " called a vote to skip the prompt";
    clearTimeout(skipTimer); skipTimer = setTimeout(() => endSkip(false, "The skip vote timed out"), VOTE_MS);
    if (!resolveSkip()) { broadcast(); render(); }
  }
  function castSkip(id, yes) {
    const v = state && state.skip; if (!v || !v.voters.includes(id) || v.yes.includes(id)) return;
    if (!yes) { const p = state.players.find(x => x.id === id); endSkip(false, (p ? p.name : "Someone") + " declined the skip vote"); return; }
    v.yes.push(id);
    if (!resolveSkip()) { broadcast(); render(); }
  }
  function resolveSkip() { // skip the prompt once every eligible voter agrees
    const v = state && state.skip; if (!v) return false;
    if (state.phase !== "game" || state.attack || state.holding || v.round !== state.roundSeq) { endSkip(false, "Skip vote cancelled"); return true; }
    v.voters = v.voters.filter(id => { const p = state.players.find(x => x.id === id); return p && p.inMatch && p.alive; });
    v.yes = v.yes.filter(id => v.voters.includes(id));
    if (!v.voters.length) { endSkip(false, "Skip vote cancelled"); return true; }
    if (v.voters.every(id => v.yes.includes(id))) {
      clearTimeout(skipTimer); skipTimer = null; state.skip = null;
      newRound();
      state.event = "Prompt skipped!";
      announceRound();
      return true;
    }
    return false;
  }
  function endSkip(passed, text) {
    clearTimeout(skipTimer); skipTimer = null;
    if (!state) return;
    state.skip = null;
    if (text) state.event = text;
    broadcast(); render();
  }

  function onGuestLeft(id) {
    delete conns[id];
    if (!state) return;
    const p = state.players.find(x => x.id === id);
    if (!p) return;
    if (state.phase === "lobby" || !p.inMatch) {
      state.players = state.players.filter(x => x.id !== id);
      checkLobbyStart();
    } else {
      p.alive = false; p.lives = 0; p.left = true; p.inRing = false;
      state.event = p.name + " left the game";
      if (state.vote) { if (state.vote.target === id) endVote(false, "Vote cancelled"); else resolveVote(); }
      if (state.skip) resolveSkip();
      if (state.attack && state.attack.id === id) { clearTimeout(attackTimer); state.attack = null; }
      if (state.phase === "over") { broadcast(); render(); return; }
      if (state.turn === id && !state.announcing && !state.holding) { clearTimeout(turnTimer); afterElimination(); return; }
      if (checkWinner()) return;
      if (state.turn === id) state.turn = nextAlive(id);
    }
    broadcast(); render();
  }

  // ---------- Host: game logic ----------
  function checkLobbyStart() {
    if (!isHost || !state || state.phase !== "lobby") return;
    if (state.players.filter(p => p.inRing).length >= 2) {
      if (!lobbyTimer) {
        localStart = Date.now() + LOBBY_MS;
        lobbyTimer = setTimeout(() => { lobbyTimer = null; localStart = 0; if (state && state.phase === "lobby") startGame(); }, LOBBY_MS);
      }
    } else {
      clearTimeout(lobbyTimer); lobbyTimer = null; localStart = 0;
    }
  }

  function startGame() {
    if (!isHost || state.players.filter(p => p.inRing).length < 2) return;
    clearTimeout(announceTimer); clearTimeout(lobbyTimer); lobbyTimer = null; localStart = 0;
    state.players.forEach(p => { p.inMatch = p.inRing; p.alive = p.inRing; p.lives = state.settings.lives; p.pts = 0; p.segs = []; p.last = null; delete p.left; delete p.eaten; });
    state.phase = "game";
    state.announcing = false; state.holding = false; state.typing = "";
    state.winner = null;
    state.event = "";
    state.turn = state.players.find(p => p.inMatch).id; state.attack = null;
    newRound();
    announceRound();
  }

  function newRound() {
    const pool = PROMPTS.filter(p => p.modes.includes(state.settings.mode));
    const choices = pool.length > 1 ? pool.filter(p => p.text !== state.prompt) : pool;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    state.prompt = pick.text;
    state.sub = pick.sub;
    state.roundSeq = (state.roundSeq || 0) + 1;
    if (state.skip) { clearTimeout(skipTimer); skipTimer = null; state.skip = null; }
    state.used = []; state.lossIds = [];
    state.players.forEach(p => { p.last = null; });
  }

  function startTurn() {
    clearTimeout(turnTimer); clearTimeout(holdTimer);
    state.announcing = false; state.holding = false; state.typing = "";
    state.remaining = state.settings.turnMs;
    localDeadline = Date.now() + state.settings.turnMs;
    turnTimer = setTimeout(onTimeout, state.settings.turnMs);
    broadcast(); render();
  }

  function announceRound() {
    clearTimeout(turnTimer); clearTimeout(announceTimer); clearTimeout(holdTimer);
    state.holding = false; state.announcing = true; state.typing = "";
    state.remaining = state.settings.turnMs;
    localDeadline = Date.now() + state.settings.turnMs;
    broadcast(); render();
    announceTimer = setTimeout(() => {
      if (!state || state.phase !== "game") return;
      startTurn();
    }, ANNOUNCE_MS);
  }

  function nextAlive(fromId) {
    const ps = state.players;
    let i = ps.findIndex(p => p.id === fromId);
    for (let n = 0; n < ps.length; n++) {
      i = (i + 1) % ps.length;
      if (ps[i].inMatch && ps[i].alive) return ps[i].id;
    }
    return fromId;
  }

  function checkWinner() {
    const alive = state.players.filter(p => p.inMatch && p.alive);
    if (alive.length <= 1) {
      clearTimeout(turnTimer); clearTimeout(announceTimer); clearTimeout(attackTimer); clearTimeout(holdTimer);
      state.announcing = false; state.holding = false; state.typing = ""; state.attack = null; state.turn = null;
      clearTimeout(voteTimer); voteTimer = null; state.vote = null; clearTimeout(skipTimer); skipTimer = null; state.skip = null;
      if (!alive[0]) { backToLobby(); return true; }
      state.phase = "over"; // winner animation plays in the arena, then everyone drops back to the lobby
      state.winner = alive[0].name; state.winnerId = alive[0].id; state.winSeq = (state.winSeq || 0) + 1;
      broadcast(); render();
      overTimer = setTimeout(backToLobby, winMs());
      return true;
    }
    return false;
  }

  function submitAnswer(id, raw) {
    if (!state || state.phase !== "game" || state.announcing || state.holding || state.attack || state.turn !== id) return;
    const prompt = PROMPTS.find(p => p.text === state.prompt);
    if (!raw.trim()) return;
    const ans = prompt.match ? prompt.match(raw, state.used) : prompt.normalize(raw);
    const player = state.players.find(p => p.id === id);
    if (!ans || !prompt.answers.includes(ans)) { tell(id, "Not a valid answer", true); return; }
    if (state.used.includes(ans)) { tell(id, ans + " was already used", true); return; }
    if (prompt.exact && !prompt.exact(raw)) { suggest(id, ans); return; } // autocorrected guess: ask the player to confirm by pressing enter again
    state.used.push(ans);
    const rKey = (prompt.rarity && prompt.rarity[ans]) || "spoon";
    const R = RARITIES[rKey];
    state.answerSeq = (state.answerSeq || 0) + 1;
    player.last = { text: ans, r: rKey, id: state.answerSeq };
    const LP = state.settings.lifePts;
    player.segs = player.segs || [];
    player.segs.push({ r: rKey, pts: R.pts });
    let gained = 0;
    while (segSum(player.segs) >= LP) { player.lives++; takeFront(player.segs, LP); gained++; } // no cap: the bar never sits full
    if (gained) state.lifeSeq = (state.lifeSeq || 0) + 1;
    player.pts = segSum(player.segs);
    state.event = player.name + " said " + ans + ", " + R.name + " +" + R.pts + " pts" + (gained ? (gained > 1 ? " · +" + gained + " lives!" : " · extra life!") : "");
    state.turn = nextAlive(id);
    const allUsed = state.used.length >= prompt.answers.length;
    const lostNext = (state.lossIds || []).includes(state.turn); // next player already lost a life on this prompt: switch prompts
    if (allUsed || lostNext) {
      // keep the current prompt (and the answer bubble) on screen for a moment before switching
      clearTimeout(turnTimer); clearTimeout(holdTimer);
      state.holding = true; state.typing = "";
      if (state.skip) { clearTimeout(skipTimer); skipTimer = null; state.skip = null; }
      state.remaining = state.settings.turnMs; localDeadline = Date.now() + state.settings.turnMs;
      state.event += allUsed ? ", all answers used, new round!" : ", new prompt!";
      const lastObj = player.last;
      holdTimer = setTimeout(() => {
        if (!state || state.phase !== "game" || !state.holding) return;
        state.holding = false;
        newRound();
        const pl = state.players.find(x => x.id === id);
        if (pl) { lastObj.stale = true; pl.last = lastObj; } // keep it so everyone still sees/hears the answer, but don't show its bubble on the new prompt
        announceRound();
      }, HOLD_MS);
      broadcast(); render();
    } else {
      startTurn();
    }
  }

  function segSum(segs) { return segs.reduce((t, s) => t + s.pts, 0); }
  function takeFront(segs, amt) {
    while (amt > 0 && segs.length) {
      if (segs[0].pts <= amt) { amt -= segs[0].pts; segs.shift(); }
      else { segs[0].pts -= amt; amt = 0; }
    }
  }

  function onTimeout() {
    const p = state.players.find(x => x.id === state.turn);
    if (!p) return;
    const kill = p.lives <= 1; // last life: the pudding eats them
    const finale = kill && state.players.filter(x => x.inMatch && x.alive && x.id !== p.id).length <= 1; // this bite ends the match
    state.attackSeq = (state.attackSeq || 0) + 1;
    state.attack = { id: p.id, kill, finale, seq: state.attackSeq };
    if (state.skip) { clearTimeout(skipTimer); skipTimer = null; state.skip = null; }
    state.event = p.name + " ran out of time!";
    broadcast(); render();
    attackTimer = setTimeout(() => { // moment of impact
      if (!state || !state.attack) return;
      p.lives = Math.max(0, p.lives - 1);
      state.lossIds = state.lossIds || []; if (!state.lossIds.includes(p.id)) state.lossIds.push(p.id);
      if (kill) { p.alive = false; p.inRing = false; p.eaten = true; state.event = "The pudding ate " + p.name + "!"; }
      else state.event = p.name + " lost a life";
      if (kill && state.vote) { if (state.vote.target === p.id) { endVote(false, "Vote cancelled"); } else resolveVote(); }
      if (kill && state.skip) resolveSkip();
      broadcast(); render();
      attackTimer = setTimeout(() => { if (!state || !state.attack) return; state.attack = null; afterElimination(); }, atkDur(state.attack) - IMPACT_MS);
    }, IMPACT_MS);
  }

  function afterElimination() {
    if (checkWinner()) return;
    const next = nextAlive(state.turn);
    const lost = (state.lossIds || []).filter(id => state.players.some(x => x.id === id));
    if (lost.length >= 2 || lost.includes(next)) { // 2 people lost a life, or it's the turn of someone who already lost one on this prompt
      newRound();
      state.turn = next;
      announceRound();
    } else {
      state.turn = next;
      startTurn();
    }
  }

  function applySettings() {
    if (!isHost || !state || state.phase !== "lobby") return;
    const lives = clampInt($("livesInput").value, 1, 10, state.settings.lives);
    const secs = clampInt($("secsInput").value, 3, 60, state.settings.turnMs / 1000);
    const lifePts = clampInt($("lifePtsInput").value, 10, 5000, state.settings.lifePts);
    const mode = MODES[$("modeInput").value] ? $("modeInput").value : state.settings.mode;
    state.settings = { lives, turnMs: secs * 1000, lifePts, mode };
    state.players.forEach(p => { p.lives = lives; });
    $("livesInput").value = lives; $("secsInput").value = secs;
    $("lifePtsInput").value = lifePts; $("modeInput").value = mode;
    broadcast(); render();
  }

  function backToLobby() { // everyone returns to the lobby as a spectator
    if (!isHost || !state) return;
    clearTimeout(overTimer); clearTimeout(announceTimer); clearTimeout(turnTimer); clearTimeout(attackTimer); clearTimeout(holdTimer);
    state.phase = "lobby"; state.holding = false; state.attack = null; state.winnerId = null; clearTimeout(voteTimer); voteTimer = null; state.vote = null; clearTimeout(skipTimer); skipTimer = null; state.skip = null;
    state.players = state.players.filter(p => !p.left);
    state.players.forEach(p => { p.lives = state.settings.lives; p.alive = true; p.inMatch = false; p.inRing = false; p.pts = 0; p.segs = []; p.last = null; delete p.eaten; });
    state.announcing = false; state.typing = "";
    state.turn = null; state.used = []; state.event = ""; state.winner = null;
    checkLobbyStart();
    broadcast(); render();
  }

  function setRing(id, on) {
    if (!isHost || !state || state.phase !== "lobby") return;
    const p = state.players.find(x => x.id === id); if (!p) return;
    if (on && !p.inRing && state.players.filter(x => x.inRing).length >= MAX_RING) { tell(id, "The ring is full"); return; }
    p.inRing = on;
    checkLobbyStart(); broadcast(); render();
  }
  function toggleRing() {
    const p = state && state.players.find(x => x.id === myId);
    if (!p || state.phase !== "lobby") return;
    if (isHost) setRing(myId, !p.inRing);
    else if (hostConn && hostConn.open) hostConn.send({ t: "ring", on: !p.inRing });
  }

  function tell(id, text, shake) {
    if (id === myId) { toast(text); if (shake) shakeInput(); return; }
    const c = conns[id]; if (c && c.open) c.send({ t: "msg", text, shake });
  }

  function suggest(id, text) {
    if (id === myId) { showSuggestion(text); return; }
    const c = conns[id]; if (c && c.open) c.send({ t: "suggest", text });
  }
  function showSuggestion(text) {
    const input = $("answerInput");
    input.value = text;
    $("dym").textContent = "Did you mean " + text + "?";
    $("dym").classList.remove("hidden");
    pushTyping(text);
    input.focus({ preventScroll: true });
    try { input.setSelectionRange(text.length, text.length); } catch (e) {}
  }

  function relayTyping(exceptId) {
    const payload = { t: "typing", text: state.typing };
    Object.keys(conns).forEach(id => { const c = conns[id]; if (id !== exceptId && c.open) c.send(payload); });
  }

  function pushTyping(text) {
    if (!state || state.phase !== "game" || state.announcing || state.holding || state.turn !== myId) return;
    state.typing = text;
    updateBubbles();
    if (isHost) relayTyping(null);
    else if (hostConn && hostConn.open) hostConn.send({ t: "typing", text: state.typing });
  }

  function broadcast() {
    if (!isHost || !state) return;
    if (state.phase === "game") {
      // remaining is computed relative to when the turn started on the host
      state.remaining = Math.max(0, localDeadline - Date.now());
    }
    state.startIn = (state.phase === "lobby" && localStart) ? Math.max(0, localStart - Date.now()) : null;
    const payload = { t: "state", state };
    Object.values(conns).forEach(c => { if (c.open) c.send(payload); });
  }

  // ---------- Client actions ----------
  function sendCallVote() {
    const target = $("voteTarget").value; if (!target) return;
    if (isHost) callVote(myId, target); else if (hostConn && hostConn.open) hostConn.send({ t: "callVote", target });
  }
  function sendVote(yes) {
    if (isHost) castVote(myId, yes); else if (hostConn && hostConn.open) hostConn.send({ t: "vote", yes });
  }
  function renderVote(game, playing) {
    const card = $("voteCard"), v = state.vote;
    card.classList.toggle("hidden", !(game && (playing || v)));
    if (!game) return;
    $("voteIdle").classList.toggle("hidden", !!v || !playing);
    $("voteActive").classList.toggle("hidden", !v);
    if (!v) {
      const sel = $("voteTarget"), prev = sel.value;
      const opts = state.players.filter(p => p.inMatch && p.alive && (state.players.filter(q => q.inMatch && q.alive && q.id !== p.id).length > 0));
      const key = opts.map(p => p.id + p.name).join("|");
      if (sel.dataset.key !== key) {
        sel.dataset.key = key; sel.textContent = "";
        opts.forEach(p => { const o = el("option", null, p.name + (p.id === myId ? " (you)" : "")); o.value = p.id; sel.appendChild(o); });
        if (opts.some(p => p.id === prev)) sel.value = prev;
      }
      return;
    }
    const canVote = v.voters.includes(myId) && !v.yes.includes(myId);
    $("voteText").textContent = v.callerName + " wants to give " + (v.target === myId ? "you" : v.targetName) + " an extra life.";
    $("voteCount").textContent = v.yes.length + "/" + v.voters.length + " agreed. Everyone must agree" + (v.target === myId ? ", including you." : ".");
    $("voteBtns").classList.toggle("hidden", !canVote);
  }
  function sendCallSkip() {
    if (isHost) callSkip(myId); else if (hostConn && hostConn.open) hostConn.send({ t: "callSkip" });
  }
  function sendSkipVote(yes) {
    if (isHost) castSkip(myId, yes); else if (hostConn && hostConn.open) hostConn.send({ t: "skipVote", yes });
  }
  function renderSkip(game, playing) {
    const card = $("skipCard"), v = state.skip;
    card.classList.toggle("hidden", !(game && (playing || v)));
    if (!game) return;
    $("skipIdle").classList.toggle("hidden", !!v || !playing);
    $("skipActive").classList.toggle("hidden", !v);
    if (!v) { $("skipCallBtn").disabled = !!state.attack || !!state.holding; return; }
    $("skipText").textContent = v.callerName + " wants to skip this prompt.";
    $("skipCount").textContent = v.yes.length + "/" + v.voters.length + " agreed. Everyone must agree.";
    $("skipBtns").classList.toggle("hidden", !(v.voters.includes(myId) && !v.yes.includes(myId)));
  }
  function sendAnswer() {
    const input = $("answerInput");
    const text = input.value;
    if (!text.trim() || !state || state.phase !== "game" || state.announcing || state.holding || state.turn !== myId) return;
    input.value = "";
    $("dym").classList.add("hidden");
    pushTyping("");
    if (isHost) submitAnswer(myId, text);
    else if (hostConn && hostConn.open) hostConn.send({ t: "answer", text });
  }

  function shakeInput() {
    playSfx("invalid");
    const i = $("answerInput");
    i.classList.remove("shake"); void i.offsetWidth; i.classList.add("shake");
  }

  // ---------- Rendering ----------
  function hearts(n) { return n <= 0 ? "-" : n <= 5 ? "♥".repeat(n) : "♥×" + n; }

  let wheelW = 520, guardFn = null, guardT = 0, jit = { x: 0, y: 0, t: 0 };
  const attrCache = new Map();
  function setA(node, name, val) { const k = node.id + name; if (attrCache.get(k) !== val) { attrCache.set(k, val); node.setAttribute(name, val); } } // skip redundant SVG writes (each one forces a repaint)
  let seatOff = {}, seatPct = {}, attackLocal = null, lastAttackSeq = 0, lastWinSeq = 0, lifeSeen = null, lastRoundSeq = 0;
  let ringSeen = null, seatMove = {}; // ringSeen: playerId -> when they joined the ring (null = not primed yet)
  function atkDur(at) { return at.kill ? EAT_MS + (at.finale ? RETURN_MS : 0) : HIT_MS; }
  function activeAtk() { return attackLocal && Date.now() - attackLocal.start < atkDur(attackLocal) ? attackLocal : null; }
  function startAttack(at) {
    attackLocal = { id: at.id, kill: at.kill, finale: at.finale, start: Date.now(), sx: pud.x, sy: pud.y };
    setTimeout(() => { if (at.kill) playSfx("eat"); playSfx("damage"); }, IMPACT_MS);
    setTimeout(() => {
      const sp = seatPct[at.id]; if (!sp) return;
      const d = el("div", "dmg", at.kill ? "CHOMP!" : "−1 ♥"); d.style.left = sp.left; d.style.top = sp.top;
      d.addEventListener("animationend", () => d.remove()); $("wheel").appendChild(d);
    }, IMPACT_MS);
  }
  function confetti(id) {
    const sp = seatPct[id]; if (!sp) return;
    const cols = Object.values(RARITIES).map(r => r.color);
    for (let i = 0; i < 28; i++) {
      const c = el("div", "confetti"); c.style.left = sp.left; c.style.top = sp.top; c.style.background = cols[i % cols.length];
      c.style.setProperty("--cx", Math.round((Math.random() * 2 - 1) * 140) + "px");
      c.style.setProperty("--cy", Math.round(-40 - Math.random() * 150) + "px");
      c.style.setProperty("--r", Math.round(Math.random() * 720) + "deg");
      c.addEventListener("animationend", () => c.remove()); $("wheel").appendChild(c);
    }
  }
  function flanBurst(f) { // extra fireworks for a Flan-tastic answer
    const w = $("wheel");
    const add = (cls, setup) => {
      const d = el("div", "fx " + cls); d.style.left = f.left; d.style.top = f.top; if (setup) setup(d);
      d.addEventListener("animationend", () => d.remove()); setTimeout(() => d.remove(), 2600); w.appendChild(d);
    };
    add("flanglow"); add("flanring");
    if (!reduceMotion) {
      add("flanring r2");
      const cols = ["#fff3a0", "#ffd23f", "#ffb02e", "#ffffff"];
      for (let i = 0; i < 18; i++) {
        const ang = i / 18 * Math.PI * 2 + Math.random() * .35, dist = 70 + Math.random() * 70, sz = 10 + Math.round(Math.random() * 10);
        add("sparkle", d => {
          d.style.setProperty("--sx", Math.round(Math.cos(ang) * dist) + "px"); d.style.setProperty("--sy", Math.round(Math.sin(ang) * dist) + "px");
          d.style.background = cols[i % cols.length]; d.style.width = d.style.height = sz + "px"; d.style.animationDelay = Math.round(Math.random() * 120) + "ms";
        });
      }
    }
    const pd = $("pudding"); pd.classList.remove("delight"); void pd.offsetWidth; pd.classList.add("delight"); // pudding is delighted
    setTimeout(() => pd.classList.remove("delight"), 900);
    w.classList.remove("flanflash"); void w.offsetWidth; w.classList.add("flanflash");
    setTimeout(() => w.classList.remove("flanflash"), 750);
  }
  function slidePos(m, now) { // where a seat currently is while sliding to its new spot
    const u = Math.min(1, (now - m.t0) / SLIDE_MS), e = 1 - Math.pow(1 - u, 3);
    return { x: m.fx + (m.tx - m.fx) * e, y: m.fy + (m.ty - m.fy) * e };
  }
  function ramPose(at, now) { // where the angry pudding is during its attack
    const t = now - at.start, off = seatOff[at.id] || { x: 0, y: 0 };
    const tx = off.x * 0.8, ty = off.y * 0.8, len = Math.hypot(tx, ty) || 1;
    const wx = at.sx - tx / len * 3, wy = at.sy - ty / len * 3;
    const L = (p, q, u) => p + (q - p) * u, out = u => 1 - Math.pow(1 - u, 3), inn = u => u * u * u;
    let x, y, sx = 1, sy = 1, open = 0, anger = 1;
    const back = at.finale ? CHEW_END_FINALE : CHEW_END; // when the post-chomp glide back to the centre begins
    if (t < 250) { const u = out(t / 250); x = L(at.sx, wx, u); y = L(at.sy, wy, u); sx = 1 + .08 * u; sy = 1 - .08 * u; }
    else if (t < IMPACT_MS) { const u = inn((t - 250) / (IMPACT_MS - 250)); x = L(wx, tx, u); y = L(wy, ty, u); sx = 1.08 - .2 * u; sy = .92 + .2 * u; }
    else if (!at.kill) { const u = Math.min(1, (t - IMPACT_MS) / 650); x = L(tx, 0, out(u)); y = L(ty, 0, out(u)); const q = Math.max(0, 1 - u * 3); sx = 1 + .18 * q; sy = 1 - .18 * q; }
    else if (t < back) { x = tx; y = ty; const m = .5 + .5 * Math.sin((t - IMPACT_MS) / 1450 * Math.PI * 6); open = .3 + .7 * m; sx = 1 + .1 * m; sy = 1 - .08 * m; }
    else if (!at.finale) { const r = Math.min(1, (t - back) / (EAT_MS - back)), u = out(r); x = L(tx, 0, u); y = L(ty, 0, u); anger = 1 - r; }
    else { // match-ending bite: glide back to the centre slowly instead of snapping there
      const r = Math.min(1, (t - back) / (EAT_MS + RETURN_MS - back)), e = r < .5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2, b = Math.sin(r * Math.PI);
      x = L(tx, 0, e); y = L(ty, 0, e); sx = 1 - .05 * b; sy = 1 + .05 * b; anger = 1 - r;
    }
    return { x, y, sx, sy, open, anger };
  }
  function bubbleGuard() { // true if a pudding centred at (x,y) % would overlap a visible text bubble
    const w = $("wheel").getBoundingClientRect();
    const bs = [...$("wheel").querySelectorAll(".bubble:not(.hidden)")].map(b => b.getBoundingClientRect());
    return (x, y) => w.width > 0 && bs.some(r => {
      const l = (r.left - w.left) / w.width * 100 - 1.5, rt = (r.right - w.left) / w.width * 100 + 1.5;
      const t = (r.top - w.top) / w.height * 100 - 1.5, b = (r.bottom - w.top) / w.height * 100 + 1.5;
      return 50 + x + 15 > l && 50 + x - 15 < rt && 50 + y + 15.5 > t && 50 + y - 15.5 < b;
    });
  }

  function renderWheel() {
    const wheel = $("wheel");
    wheelW = wheel.offsetWidth || wheelW;
    wheel.querySelectorAll(".seat").forEach(s => s.remove());
    const ps = state.players.filter(p => state.phase === "lobby" ? p.inRing : p.inMatch), n = ps.length;
    const myIdx = Math.max(0, ps.findIndex(p => p.id === myId));
    let lookAngle = null;
    const LP = state.settings.lifePts, fresh = [], atk = activeAtk(), now = Date.now();
    seatOff = {}; seatPct = {};
    const inLobby = state.phase === "lobby"; let prime = false;
    if (inLobby && !ringSeen) { ringSeen = {}; prime = true; } // players already in the ring when we arrive don't animate
    ps.forEach((p, i) => {
      const a = Math.PI / 2 + 2 * Math.PI * (i - myIdx) / n; // me at the bottom
      const R = 38, cs = Math.cos(a), sn = Math.sin(a);
      const X = 50 + R * cs, Y = 50 + R * sn, leftS = X + "%", topS = Y + "%";
      const seat = el("div", "seat");
      seat.dataset.id = p.id;
      // when the ring re-spaces (someone joins/leaves), seats glide to their new spots
      let m = seatMove[p.id], px = X, py = Y, slideMs = 0;
      if (!m) m = seatMove[p.id] = { fx: X, fy: Y, tx: X, ty: Y, t0: 0 };
      else if (Math.abs(m.tx - X) > .01 || Math.abs(m.ty - Y) > .01) { const c = slidePos(m, now); m = seatMove[p.id] = { fx: c.x, fy: c.y, tx: X, ty: Y, t0: now }; }
      if (now - m.t0 < SLIDE_MS) { const c = slidePos(m, now); px = c.x; py = c.y; slideMs = Math.round(SLIDE_MS - (now - m.t0)); }
      seat.style.left = px + "%";
      seat.style.top = py + "%";
      if (slideMs) requestAnimationFrame(() => requestAnimationFrame(() => {
        const tr = " " + slideMs + "ms cubic-bezier(.33,1,.68,1)";
        seat.style.transition = "left" + tr + ", top" + tr; seat.style.left = leftS; seat.style.top = topS;
      }));
      if (inLobby) { // joining-the-ring fade-in
        if (!(p.id in ringSeen)) ringSeen[p.id] = prime ? 0 : now;
        const jt = ringSeen[p.id];
        if (jt && now - jt < JOIN_MS) { seat.classList.add("joining"); seat.style.setProperty("--jd", "-" + (now - jt) + "ms"); }
      }
      seatOff[p.id] = { x: R * cs, y: R * sn }; seatPct[p.id] = { left: leftS, top: topS };
      const hit = atk && atk.id === p.id;
      if (p.id === myId) seat.classList.add("me");
      if (!p.alive && !hit) seat.classList.add("dead");
      if (p.eaten && !hit) seat.classList.add("eaten");
      if (state.phase === "over" && p.id === state.winnerId) seat.classList.add("winner");
      if (!state.announcing && !state.holding && p.id === state.turn) { seat.classList.add("turn"); lookAngle = a; }
      seat.appendChild(el("div", "bubble hidden"));
      const face = el("div", "face");
      face.innerHTML = hit && now - atk.start > 200 ? faceHurt(p.accessory, p.accColor) : p.alive ? faceAlive(p.color, p.face, p.accessory, p.accColor) : faceDead(p.color, p.accessory, p.accColor);
      if (hit) {
        seat.classList.add(atk.kill ? "eating" : "hurt");
        seat.style.setProperty("--ox", (cs * 22) + "px"); seat.style.setProperty("--oy", (sn * 22) + "px");
        seat.style.setProperty("--ix", (-cs * 40) + "px"); seat.style.setProperty("--iy", (-sn * 40) + "px");
        face.style.setProperty("--ad", "-" + (now - atk.start) + "ms"); // keep the animation in sync across re-renders
      }
      seat.appendChild(face);
      seat.appendChild(el("div", "pname", p.name));
      seat.appendChild(el("div", "hearts", hearts(p.lives)));
      const bar = el("div", "pts");
      (p.segs || []).forEach(sg => {
        const d = el("div");
        d.style.width = Math.min(100, sg.pts / LP * 100) + "%";
        d.style.background = (RARITIES[sg.r] || RARITIES.spoon).color;
        bar.appendChild(d);
      });
      bar.title = (p.pts || 0) + "/" + LP + " pts";
      seat.appendChild(bar);
      seat.appendChild(el("div", "ptstxt", (p.pts || 0) + "/" + LP));
      wheel.appendChild(seat);
      if (p.last) {
        if (seenAnswer[p.id] !== p.last.id) {
          if (RARITIES[p.last.r]) fresh.push({ r: p.last.r, left: leftS, top: topS, dx: Math.round((Math.random() * 2 - 1) * 34) });
          seenAnswer[p.id] = p.last.id;
        }
      } else delete seenAnswer[p.id];
    });
    if (ringSeen) Object.keys(ringSeen).forEach(id => { if (!ps.some(p => p.id === id)) delete ringSeen[id]; }); // leaving + rejoining animates again
    if (fresh.length) playSfx(fresh.some(f => f.r === "flan") ? "flantastic" : "answer");
    fresh.forEach(f => {
      const pt = el("div", "particle" + (f.r === "flan" ? " flan" : ""));
      const ic = el("span"); ic.innerHTML = ICONS[f.r]; pt.appendChild(ic);
      const rn = el("span", "rname", RARITIES[f.r].name + (f.r === "flan" ? "!" : "")); rn.style.color = RARITIES[f.r].color; pt.appendChild(rn);
      pt.style.setProperty("--dx", f.dx + "px");
      pt.style.left = f.left; pt.style.top = f.top;
      pt.addEventListener("animationend", () => pt.remove());
      wheel.appendChild(pt);
      if (f.r === "flan") flanBurst(f);
    });
    look = lookAngle == null ? null : { x: Math.cos(lookAngle), y: Math.sin(lookAngle) };
    const dx = look ? look.x * 4 : 0, dy = look ? look.y * 4 : 0;
    $("pupils").style.transform = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px)";
    updateBubbles();
  }

  function updateBubbles() {
    if (!state) return;
    $("wheel").querySelectorAll(".seat").forEach(s => {
      const b = s.querySelector(".bubble");
      if (state.attack && state.attack.id === s.dataset.id) { b.classList.add("hidden"); return; }
      const active = state.phase === "game" && !state.announcing && !state.holding && s.dataset.id === state.turn;
      const pl = state.players.find(x => x.id === s.dataset.id);
      b.style.removeProperty("--bt"); b.style.removeProperty("--bc"); b.classList.remove("flanb");
      b.title = "";
      if (active) {
        b.classList.remove("hidden");
        const t = state.typing || "";
        b.textContent = "";
        b.appendChild(el("span", null, t ? t : "…"));
        b.classList.toggle("empty", !t);
      } else if (state.phase === "game" && !state.announcing && pl && pl.last && !pl.last.stale && RARITIES[pl.last.r]) {
        const R = RARITIES[pl.last.r];
        b.classList.remove("hidden", "empty");
        b.style.setProperty("--bt", R.color); b.style.setProperty("--bc", R.color); b.classList.toggle("flanb", pl.last.r === "flan");
        b.title = pl.last.text + " · " + R.name + " · " + R.pts + " pts";
        b.textContent = "";
        b.appendChild(el("span", null, pl.last.text));
      } else {
        b.classList.add("hidden");
      }
    });
  }

  function fillPlayers(ul) {
    ul.textContent = "";
    const live = state.phase !== "lobby";
    state.players.forEach((p, i) => {
      const li = el("li");
      if (p.id === myId) li.classList.add("me");
      if (state.phase === "game" && p.id === state.turn) li.classList.add("turn");
      if (live && p.inMatch && !p.alive) li.classList.add("dead");
      li.appendChild(el("span", "name", p.name));
      const meta = el("span", "meta");
      if (p.id === state.hostId) meta.appendChild(el("span", "tag", "host"));
      if (live && p.inMatch && p.alive) meta.appendChild(el("span", "hearts", hearts(p.lives)));
      else if (!live && p.inRing) meta.appendChild(el("span", "tag on", "in ring"));
      else meta.appendChild(el("span", "tag", live && p.inMatch ? (p.eaten ? "eaten" : "out") : "spectating"));
      li.appendChild(meta);
      ul.appendChild(li);
    });
  }

  function lobbyLine() {
    if (state.players.filter(p => p.inRing).length < 2) return "Waiting for 2 players in the ring…";
    if (!localStart) return "Starting…";
    return "Starting in " + Math.ceil(Math.max(0, localStart - Date.now()) / 1000) + "s";
  }

  function render() {
    if (!state) return;
    if (state.attack && state.attack.seq !== lastAttackSeq) { lastAttackSeq = state.attack.seq; startAttack(state.attack); }
    if (state.phase !== "game") { seenAnswer = {}; document.querySelectorAll(".particle").forEach(p => p.remove()); }
    if (state.phase !== "lobby") { ringSeen = null; seatMove = {}; }
    show("game");
    document.querySelector("main > h1").classList.toggle("hidden", state.phase !== "lobby");
    const lobby = state.phase === "lobby", game = state.phase === "game", over = state.phase === "over";
    const me = state.players.find(p => p.id === myId);
    const playing = game && !!me && me.inMatch && me.alive;
    $("lobbyCode").textContent = state.code;
    fillPlayers($("lobbyPlayers"));
    ["livesInput","secsInput","lifePtsInput","modeInput"].forEach(i => { $(i).disabled = !isHost || !lobby; });
    if (document.activeElement !== $("livesInput")) $("livesInput").value = state.settings.lives;
    if (document.activeElement !== $("secsInput")) $("secsInput").value = state.settings.turnMs / 1000;
    if (document.activeElement !== $("lifePtsInput")) $("lifePtsInput").value = state.settings.lifePts;
    if (document.activeElement !== $("modeInput")) $("modeInput").value = state.settings.mode;
    $("settingsCard").classList.toggle("hidden", !lobby);
    $("setHint").textContent = !isHost ? "Only the host can change these." : lobby ? "You're the host. Settings lock once the match starts." : "Settings are locked during the match.";
    const rb = $("ringBtn"), inRing = !!(me && me.inRing);
    rb.textContent = lobby ? (inRing ? "Leave ring (just watch)" : "Join the ring") : over ? "Match ending…" : playing ? "You're in the match" : "Spectating until the match ends";
    rb.disabled = !lobby || (!inRing && state.players.filter(p => p.inRing).length >= MAX_RING);
    rb.classList.toggle("ghost", lobby && inRing);
    $("startNowBtn").classList.toggle("hidden", !(isHost && lobby && localStart && state.players.filter(p => p.inRing).length >= 2)); // host can skip the countdown
    $("promptText").textContent = lobby ? (inRing ? "You're in the ring!" : "Join the ring!") : over ? (state.winner || "Nobody") + " wins!" : state.prompt;
    $("promptSub").textContent = lobby ? "The match starts 15 seconds after at least 2 players join the ring (the host can start it early). Or just spectate." : over ? "" : (state.sub || "");
    const ann = game && !!state.announcing;
    const hold = game && !!state.holding;
    const mine = game && state.turn === myId && !ann && !hold && !state.attack;
    const cur = state.players.find(p => p.id === state.turn);
    $("turnLine").textContent = lobby ? lobbyLine() : over ? "" : ann ? "Get ready…" : hold ? "New prompt coming…" : mine ? "Your turn!" : (cur ? cur.name + "'s turn" : "");
    $("answerRow").classList.toggle("hidden", !playing);
    $("answerBtn").disabled = !mine;
    $("answerInput").placeholder = mine ? "Type your answer" : "Prepare your answer…";
    if (!game) $("answerInput").value = "";
    if (!mine) $("dym").classList.add("hidden");
    $("announce").classList.toggle("hidden", !ann);
    $("annTheme").textContent = state.prompt || "";
    $("annSub").textContent = state.sub || "";
    if (mine) {
      if (document.activeElement !== $("answerInput")) $("answerInput").focus({ preventScroll: true });
      const v = $("answerInput").value;
      if (v && v !== state.typing) pushTyping(v);
    }
    $("eventLog").textContent = state.event || "";
    renderVote(game, playing);
    renderSkip(game, playing);
    if (lifeSeen === null) lifeSeen = state.lifeSeq || 0; // don't play for lives gained before we arrived
    else if ((state.lifeSeq || 0) !== lifeSeen) { lifeSeen = state.lifeSeq || 0; playSfx("extralife"); }
    if (ann && state.roundSeq !== lastRoundSeq) { lastRoundSeq = state.roundSeq; playSfx("newprompt"); }
    renderWheel();
    if (over && state.winSeq !== lastWinSeq) { lastWinSeq = state.winSeq; playSfx("win"); confetti(state.winnerId); setTimeout(() => confetti(state.winnerId), 900); }
  }

  let nextBlink = Date.now() + 2500, blinkStart = 0, blinkAgain = false;
  function blinkScale(now) { // 1 = eyes open, ~0.08 = closed; blinks every few seconds, sometimes twice
    if (!blinkStart) {
      if (now < nextBlink) return 1;
      blinkStart = now;
    }
    const t = (now - blinkStart) / 160;
    if (t >= 1) {
      blinkStart = 0;
      if (!blinkAgain && Math.random() < 0.2) { blinkAgain = true; nextBlink = now + 120; }
      else { blinkAgain = false; nextBlink = now + 2500 + Math.random() * 3500; }
      return 1;
    }
    return 1 - 0.92 * Math.sin(t * Math.PI);
  }

  // Timer bar + pudding animation (runs every frame so the ram/damage motion is smooth)
  let lastTurnLine = "", postAtk = false; // postAtk: an attack just finished, so stay calm until the next round is announced
  function frame() {
    requestAnimationFrame(frame); // schedule first so an error can't kill the loop
    if (!state) return;
    const inGame = state.phase === "game", inLobby = state.phase === "lobby";
    const now = Date.now(), dt = Math.min(0.2, (now - lastTick) / 1000); lastTick = now;
    const left = Math.max(0, localDeadline - now), total = state.settings.turnMs;
    const ann = !inGame || !!state.announcing || !!state.holding;
    let frac = 0;
    if (inGame) frac = ann ? 1 : left / total;
    else if (inLobby) { frac = localStart ? Math.max(0, localStart - now) / LOBBY_MS : 0; const ll = lobbyLine(); if (ll !== lastTurnLine) { lastTurnLine = ll; $("turnLine").textContent = ll; } }
    $("timerFill").style.transform = "scaleX(" + frac + ")";
    $("timer").classList.toggle("low", inGame && !ann && left < Math.min(3000, total * 0.3));

    // Pudding: drifts toward the current player (never into their text bubble), then rams them when time is up
    const atk = activeAtk(), pd = $("pudding");
    let a = 0, pose = null;
    if (atk) { postAtk = true; pose = ramPose(atk, now); a = pose.anger; pud.x = pose.x; pud.y = pose.y; }
    else {
      if (postAtk && (ann || !inGame)) postAtk = false;
      const calm = ann || postAtk || !inGame; // no build-up anger after an attack, between rounds, or once the match is over
      const pr = calm ? 0 : Math.min(1, Math.max(0, 1 - left / total));
      a = pr < 0.4 ? 0 : Math.pow((pr - 0.4) / 0.6, 1.4); // calm for the first 40% of the turn
      let tx = (look && !ann) ? look.x * PUD_MAX_R : 0, ty = (look && !ann) ? look.y * PUD_MAX_R : 0;
      if (!guardFn || now - guardT > 50) { guardFn = bubbleGuard(); guardT = now; } // bubbles rarely move; don't measure the DOM every frame
      const hitFn = guardFn;
      if (tx || ty) { let sc = 1; while (sc > 0.05 && hitFn(tx * sc, ty * sc)) sc -= 0.1; sc = Math.max(0, sc); tx *= sc; ty *= sc; }
      const k = 1 - Math.exp(-dt * (hitFn(pud.x, pud.y) ? 3 : 0.15 + 0.5 * a));
      pud.x += (tx - pud.x) * k; pud.y += (ty - pud.y) * k;
    }
    const j = (!reduceMotion && !atk && a > 0.6) ? (a - 0.6) * 1.5 : 0;
    if (now - jit.t > 50) { jit = { x: Math.random() - 0.5, y: Math.random() - 0.5, t: now }; } // shake at ~20 Hz regardless of frame rate
    pd.classList.toggle("ram", !!atk);
    // position with transform (GPU-composited) instead of left/top (forces layout every frame)
    const px = (pud.x + jit.x * j) / 100 * wheelW, py = (pud.y + jit.y * j) / 100 * wheelW;
    const sx = pose ? pose.sx : 1, sy = pose ? pose.sy : 1;
    pd.style.transform = "translate(calc(-50% + " + px.toFixed(2) + "px),calc(-50% + " + py.toFixed(2) + "px)) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
    setA($("pudTint"), "opacity", (a * 0.4).toFixed(3));
    const bs = blinkScale(now);
    setA($("eyes"), "transform", bs < 1 ? "translate(0 80) scale(1 " + bs.toFixed(3) + ") translate(0 -80)" : "");
    const bo = Math.min(1, a * 3).toFixed(2);
    const bl = $("browL"), br = $("browR");
    setA(bl, "opacity", bo); setA(br, "opacity", bo);
    const yo = (68 - a * 2).toFixed(1), yi = (70 + a * 7).toFixed(1);
    setA(bl, "y1", yo); setA(bl, "y2", yi); setA(br, "y1", yo); setA(br, "y2", yi);
    const open = pose ? pose.open : 0;
    setA($("pudMouth"), "d", open > 0.05 ? "M50 91 Q60 " + (91 + 24 * open).toFixed(1) + " 70 91 Z"
      : state.phase === "over" ? "M54 98 Q60 92 66 98" : "M54 94 Q60 " + (99 - 17 * a).toFixed(1) + " 66 94");
    setA($("pudMouth"), "fill", open > 0.05 ? "#6b2606" : "none");
  }
  requestAnimationFrame(frame);

  Character.init();
  initSfxSliders();

  // ---------- Wire up ----------
  $("createBtn").onclick = () => createLobby();
  $("joinBtn").onclick = joinLobby;
  $("codeInput").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase(); });
  $("codeInput").addEventListener("keydown", e => { if (e.key === "Enter") joinLobby(); });
  $("livesInput").addEventListener("change", applySettings);
  $("secsInput").addEventListener("change", applySettings);
  $("lifePtsInput").addEventListener("change", applySettings);
  $("modeInput").addEventListener("change", applySettings);
  $("ringBtn").onclick = toggleRing;
  $("voteCallBtn").onclick = sendCallVote;
  $("skipCallBtn").onclick = sendCallSkip;
  $("skipYesBtn").onclick = () => sendSkipVote(true);
  $("skipNoBtn").onclick = () => sendSkipVote(false);
  $("voteYesBtn").onclick = () => sendVote(true);
  $("voteNoBtn").onclick = () => sendVote(false);
  $("startNowBtn").onclick = () => { if (isHost && state && state.phase === "lobby") startGame(); };
  $("leaveBtn").onclick = teardown;
  $("answerBtn").onclick = sendAnswer;
  $("answerInput").addEventListener("input", e => { $("dym").classList.add("hidden"); pushTyping(e.target.value); });
  $("answerInput").addEventListener("keydown", e => { if (e.key === "Enter") sendAnswer(); });
  $("lobbyCode").onclick = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(roomCode).then(() => toast("Code copied")).catch(() => {});
  };
  window.addEventListener("beforeunload", () => { try { peer && peer.destroy(); } catch (e) {} });
})();
