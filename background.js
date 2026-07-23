// ============================================================
// background.js — Service Worker
// Handles messages from the LeetCode / HackerRank content
// scripts and manages chrome.storage.
// ============================================================

/**
 * Given the date a problem was solved, generate the 4 revision dates.
 * Spaced repetition intervals: Day 3, 7, 14, 30
 * @param {string} dateSolved - ISO date string
 * @returns {string[]} Array of ISO date strings
 */
function generateRevisionDates(dateSolved) {
  const base = new Date(dateSolved);
  const intervals = [3, 7, 14, 30];

  return intervals.map((days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    // Return just the date portion (YYYY-MM-DD)
    return d.toISOString().split("T")[0];
  });
}

/**
 * Save a newly solved problem to chrome.storage.local.
 * If the problem already exists, we do NOT overwrite it
 * (the user may have revision progress we don't want to lose).
 */
async function saveProblem(problemData) {
  const { url, title, difficulty, dateSolved, platform } = problemData;

  // Load existing problems
  const result = await chrome.storage.local.get("problems");
  const problems = result.problems || {};

  // Use the URL as a unique key
  if (problems[url]) {
    console.log("[Code Reviser] Problem already saved:", title);
    return;
  }

  // Build the revision schedule
  const revisionDates = generateRevisionDates(dateSolved);

  problems[url] = {
    title,
    url,
    difficulty,
    dateSolved,
    platform: platform || "LeetCode", // default keeps old saved data working
    revisionDates,      // ["YYYY-MM-DD", ...] — the 4 upcoming dates
    currentRevision: 0, // tracks which revision index we're on (0–3)
    recallHistory: [],  // stores "easy" | "medium" | "hard" per revision
  };

  await chrome.storage.local.set({ problems });
  console.log("[Code Reviser] Saved problem:", title, "(" + (platform || "LeetCode") + ")", revisionDates);
}

/**
 * Handle a recall rating from the popup (easy / medium / hard).
 * - easy / medium → advance to next revision date
 * - hard → reset the revision cycle from the beginning
 */
async function handleRecall({ url, rating }) {
  const result = await chrome.storage.local.get("problems");
  const problems = result.problems || {};

  const problem = problems[url];
  if (!problem) return;

  // Record the rating
  problem.recallHistory.push({ rating, date: new Date().toISOString().split("T")[0] });

  if (rating === "hard") {
    // Reset: regenerate revision dates from today
    const today = new Date().toISOString().split("T")[0];
    problem.revisionDates = generateRevisionDates(today);
    problem.currentRevision = 0;
    console.log("[Code Reviser] Reset revision cycle for:", problem.title);
  } else {
    // Advance to next revision slot
    problem.currentRevision = Math.min(
      problem.currentRevision + 1,
      problem.revisionDates.length // cap at length = all done
    );
    console.log(
      "[Code Reviser] Advanced revision for:",
      problem.title,
      "→ slot",
      problem.currentRevision
    );
  }

  problems[url] = problem;
  await chrome.storage.local.set({ problems });
}

// ── Message Router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PROBLEM_SOLVED") {
    saveProblem(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "RECALL_RATING") {
    handleRecall(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
