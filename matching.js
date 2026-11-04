// Answer matching helpers (loaded before prompts.js)

  const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };

  function answerKey(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ").replace(/\band\b/g, "n").replace(/[^a-z0-9]/g, "");
  }
  function tokens(s) { return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’`]/g, "").replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(Boolean); }
  function within1(a, b) { // true if a and b differ by at most one typo (substitute / insert / delete / swap)
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      let i = 0; while (a[i] === b[i]) i++;
      return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
    }
    const [x, y] = la < lb ? [a, b] : [b, a];
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    return x.slice(i) === y.slice(i + 1);
  }
  function tieredPrompt(text, sub, modes, tiers) {
    const answers = [], rarity = {}, entries = [];
    Object.keys(tiers).forEach(r => tiers[r].forEach(a => {
      answers.push(a); rarity[a] = r;
      const w = tokens(a); entries.push({ a, key: answerKey(a), words: new Set(w), long: w.length >= 5 });
    }));
    return { text, sub, modes, answers, rarity,
      match(raw, used) {
        const key = answerKey(raw); if (!key) return null;
        const ex = entries.find(e => e.key === key); if (ex) return ex.a; // spaces/punctuation never matter
        const typed = new Set(tokens(raw)), c = [];
        entries.forEach(e => {
          let score = 0;
          if (key.length >= 4 && e.key.length >= 4 && within1(key, e.key)) score = 100;           // one misspelled character
          else if (e.long) { const n = [...e.words].filter(w => typed.has(w) || (w.length >= 5 && key.includes(w))).length; if (n >= 3) score = n; } // any 3 words of a long answer
          if (score) c.push({ a: e.a, score });
        });
        c.sort((x, y) => (used.includes(x.a) - used.includes(y.a)) || (y.score - x.score));
        return c.length ? c[0].a : null;
      } };
  }
