// ============================================================
// content-hackerrank.js — Content Script for HackerRank
// Runs on https://www.hackerrank.com/challenges/* (and contest
// variants) pages. Watches for a fully-passed submission result
// and reports it, same shape as the LeetCode content script.
//
// NOTE: HackerRank's DOM/class names change fairly often across
// their editor revisions. If problems stop being auto-detected,
// this is the file to update — see nodeIndicatesSuccess() below.
// ============================================================

(function () {
  "use strict";

  if (window.__hrReviserActive) return;
  window.__hrReviserActive = true;

  // ── Helpers ────────────────────────────────────────────────

  /** Extract the problem title from the page <title> or heading. */
  function getProblemTitle() {
    // HackerRank titles look like: "Problem Name | HackerRank"
    const pageTitle = document.title || "";
    const match = pageTitle.match(/^(.+?)\s*\|/);
    if (match) return match[1].trim();

    const heading =
      document.querySelector('[class*="challenge-page-title"]') ||
      document.querySelector(".ui-icon-title") ||
      document.querySelector('[class*="challenge-title"]') ||
      document.querySelector("h1");
    return heading ? heading.textContent.trim() : "Unknown Problem";
  }

  /** Extract difficulty from the badge shown on the page. */
  function getDifficulty() {
    const badge = document.querySelector(
      '[class*="difficulty"],' + '.difficulty-block'
    );
    if (badge) {
      const text = badge.textContent.trim().toLowerCase();
      if (text.includes("easy") || text.includes("basic")) return "Easy";
      if (text.includes("medium") || text.includes("intermediate")) return "Medium";
      if (text.includes("hard") || text.includes("advanced") || text.includes("expert")) return "Hard";
    }
    return "Unknown";
  }

  /** Return today's date as YYYY-MM-DD */
  function today() {
    return new Date().toISOString().split("T")[0];
  }

  // ── Detection Logic ────────────────────────────────────────

  /**
   * Check whether a DOM node (or its subtree) indicates a fully
   * successful submission. HackerRank shows things like:
   *   "All test cases passed!"
   *   "Congratulations! ... passed"
   *   "3/3 Test Cases" (with a success/green state)
   * This is heuristic — widen/narrow as needed for your account's UI.
   */
  function nodeIndicatesSuccess(node) {
    if (!node || !node.textContent) return false;
    const text = node.textContent;

    if (/all test cases passed/i.test(text)) return true;
    if (/congratulations/i.test(text) && /passed/i.test(text)) return true;

    // "3/3 Test Cases passed" style — only counts if numerator === denominator
    const m = text.match(/(\d+)\s*\/\s*(\d+)\s*test cases?/i);
    if (m && Number(m[1]) > 0 && m[1] === m[2]) return true;

    return false;
  }

  let alreadyReported = false; // guard — send message only once per page load

  function reportSolvedProblem() {
    if (alreadyReported) return;
    alreadyReported = true;

    const data = {
      title: getProblemTitle(),
      url: window.location.href.split("?")[0],
      difficulty: getDifficulty(),
      dateSolved: today(),
      platform: "HackerRank",
    };

    console.log("[Code Reviser] Detected accepted submission (HackerRank):", data);

    chrome.runtime.sendMessage({ type: "PROBLEM_SOLVED", data }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[Code Reviser]", chrome.runtime.lastError.message);
      } else if (response?.success) {
        console.log("[Code Reviser] Problem saved successfully.");
      }
    });
  }

  // ── MutationObserver ───────────────────────────────────────
  // HackerRank's editor is a SPA — results render via DOM mutation.

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (nodeIndicatesSuccess(node)) {
          setTimeout(reportSolvedProblem, 800);
          return;
        }
      }

      if (
        mutation.type === "characterData" &&
        nodeIndicatesSuccess(mutation.target)
      ) {
        setTimeout(reportSolvedProblem, 800);
        return;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // ── SPA Navigation Guard ───────────────────────────────────
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      alreadyReported = false;
    }
  }).observe(document, { subtree: true, childList: true });

  console.log("[Code Reviser] HackerRank content script active on:", window.location.href);
})();
