// All prompts now live in prompt-list.js (plain text, no coding needed).
// Helpers (tieredPrompt, parsePromptList, WORDS, editDist) come from matching.js.

const PROMPTS = parsePromptList(PROMPT_LIST);

// Advanced: a prompt that needs custom code can still be added here, e.g.
// PROMPTS.push(tieredPrompt("Title", "sub text", ["sulka", "social"], { spoon: ["A"], slice: ["B"] }));
