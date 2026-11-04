// Prompts and their answers. Edit this file to add or change prompts.
// Helpers (tieredPrompt, WORDS, within1) come from matching.js.

  const PROMPTS = [
    { text: "Numbers 1 through 10", sub: "", modes: ["sulka", "social"],
      answers: ["1","2","3","4","5","6","7","8","9","10"],
      // two numbers per rarity (testing)
      rarity: { "5":"spoon","6":"spoon", "4":"slice","7":"slice", "3":"rare","8":"rare", "2":"deep","9":"deep", "1":"flan","10":"flan" },
      normalize(raw) {
        const t = raw.trim().toLowerCase().replace(/\s+/g, "");
        if (t in WORDS) return String(WORDS[t]);
        if (/^\d+$/.test(t)) return String(parseInt(t, 10));
        const m = Object.keys(WORDS).filter(w => w.length >= 4 && within1(t, w));
        return m.length === 1 ? String(WORDS[m[0]]) : null;
      } },
    tieredPrompt("Games made by Kultisti", "", ["sulka"], {
      spoon: ["Sulka", "Frogfall"],
      slice: ["Curseball", "Raide", "Dice of Dusk", "Planetaario", "Epolevne", "Steptile", "lineoff", "Taulu"],
      rare: ["Hop Owl", "Had", "lose95", "Planetwo", "Cog Owl", "Lonely People Potion Shop",
             "Don't Eat My Mind You Stupid Monsters!",
             "River the Dinosaur and the Mysterious Portal that Ate the Entire Existence",
             "Out Twogether", "Dice Catcher", "Rusty Wind Blows", "NullCat", "Virus Village", "Snaklipse",
             "Katti", "Pipe Skull", "Cats n Wires", "Kissa", "Onward Blocks", "Skele Magic", "Juurru"],
      deep: ["Midnight Cartridge", "Pack a Block", "Past The Lamp Town", "Loihtija", "maskless",
             "Two Creatures and the Fence of Stone", "00", "0 = 0 = 0", "Roborazzi", "0", "OOO", "bababox-x", "orld"],
      flan: ["Ninjack Rabbit", "Underneath"]
    })
  ];

  // Easy text-based prompts (edit prompt-list.js)
  PROMPTS.push(...parsePromptList(PROMPT_LIST));
