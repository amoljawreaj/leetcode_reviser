// ============================================================
// content-leetcode.js — Content Script for LeetCode
// Runs on https://leetcode.com/problems/* pages.
// Watches for an "Accepted" submission result and reports it.
// ============================================================

(function () {
  "use strict";

  // Avoid registering multiple observers if script re-runs
  if (window.__lcReviserActive) return;
  window.__lcReviserActive = true;

  // ── Helpers ────────────────────────────────────────────────

  /** Extract the problem title from the page <title> or heading. */
  function getProblemTitle() {
    // LeetCode puts the problem name in the <title>: "Two Sum - LeetCode"
    const pageTitle = document.title || "";
    const match = pageTitle.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();

    // Fallback: look for the h4 / h1 heading in the problem pane
    const heading =
      document.querySelector('[data-cy="question-title"]') ||
      document.querySelector("h4") ||
      document.querySelector("h1");
    return heading ? heading.textContent.trim() : "Unknown Problem";
  }

  /** Extract difficulty from the badge shown on the page. */
  function getDifficulty() {
    // LeetCode renders a coloured difficulty label
    const badge = document.querySelector(
      '[diff],' +                          // some versions use a "diff" attr
      '.text-difficulty-easy,' +
      '.text-difficulty-medium,' +
      '.text-difficulty-hard,' +
      '[class*="difficulty"]'
    );
    if (badge) {
      const text = badge.textContent.trim().toLowerCase();
      if (text.includes("easy")) return "Easy";
      if (text.includes("medium")) return "Medium";
      if (text.includes("hard")) return "Hard";
    }
    return "Unknown";
  }

  /** Return today's date as YYYY-MM-DD */
  function today() {
    return new Date().toISOString().split("T")[0];
  }

  // ── Detection Logic ────────────────────────────────────────

  /**
   * Check whether a DOM node (or its subtree) contains the "Accepted" verdict.
   * LeetCode shows a green "Accepted" banner/toast after a successful submit.
   */
  function nodeContainsAccepted(node) {
    if (!node || !node.textContent) return false;
    // Must be exactly or contain the word "Accepted" (not "Wrong Answer" etc.)
    return /\bAccepted\b/.test(node.textContent);
  }

  let alreadyReported = false; // guard — send message only once per page load

  function reportSolvedProblem() {
    if (alreadyReported) return;
    alreadyReported = true;

    const data = {
      title: getProblemTitle(),
      url: window.location.href.split("?")[0], // strip query params
      difficulty: getDifficulty(),
      dateSolved: today(),
      platform: "LeetCode",
    };

    console.log("[Code Reviser] Detected accepted submission (LeetCode):", data);

    chrome.runtime.sendMessage({ type: "PROBLEM_SOLVED", data }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[Code Reviser]", chrome.runtime.lastError.message);
      } else if (response?.success) {
        console.log("[Code Reviser] Problem saved successfully.");
      }
    });
  }

  // ── MutationObserver ───────────────────────────────────────
  // LeetCode is a SPA — results appear via DOM mutations, not page reloads.

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Check the newly added node and its descendants
        if (nodeContainsAccepted(node)) {
          // Small delay so the page finishes rendering difficulty / title
          setTimeout(reportSolvedProblem, 800);
          return;
        }
      }

      // Also check attribute / text changes on existing nodes
      if (
        mutation.type === "characterData" &&
        nodeContainsAccepted(mutation.target)
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
  // If the user navigates to a different problem (URL changes) reset the flag.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      alreadyReported = false; // reset for the new problem
    }
  }).observe(document, { subtree: true, childList: true });

  console.log("[Code Reviser] LeetCode content script active on:", window.location.href);
})();
