// ============================================================
// popup.js — Popup Script
// Reads chrome.storage.local, renders due/all problems
// (LeetCode + HackerRank), and handles the recall-rating modal.
// ============================================================

// ── State ──────────────────────────────────────────────────

let activePlatformFilter = "all"; // "all" | "LeetCode" | "HackerRank"

// ── Utility ────────────────────────────────────────────────

/** Return today as YYYY-MM-DD */
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/** Colour class for difficulty badges */
function diffClass(difficulty) {
  switch ((difficulty || "").toLowerCase()) {
    case "easy":   return "diff-easy";
    case "medium": return "diff-medium";
    case "hard":   return "diff-hard";
    default:       return "diff-unknown";
  }
}

/** Colour class + short label for platform badges */
function platformInfo(platform) {
  if (platform === "HackerRank") {
    return { cls: "platform-hr", label: "HR" };
  }
  return { cls: "platform-lc", label: "LC" };
}

/**
 * Determine the next revision date for a problem.
 * Returns null if all revisions are complete.
 */
function nextRevisionDate(problem) {
  const { revisionDates, currentRevision } = problem;
  if (currentRevision >= revisionDates.length) return null; // done
  return revisionDates[currentRevision];
}

/**
 * Is this problem due today (or overdue)?
 */
function isDueToday(problem) {
  const next = nextRevisionDate(problem);
  if (!next) return false;
  return next <= todayStr(); // overdue problems also show up
}

/** Does this problem match the active platform filter? */
function matchesFilter(problem) {
  if (activePlatformFilter === "all") return true;
  return (problem.platform || "LeetCode") === activePlatformFilter;
}

// ── Render ─────────────────────────────────────────────────

/**
 * Build a single problem card element.
 * @param {object} problem
 * @param {boolean} showReviseButton  – true for "due today" cards
 */
function buildCard(problem, showReviseButton) {
  const card = document.createElement("div");
  card.className = "problem-card";

  // Revision progress indicator (e.g. "Rev 2/4")
  const total = problem.revisionDates.length;
  const done  = Math.min(problem.currentRevision, total);
  const progressLabel =
    done >= total
      ? `<span class="progress done">✓ Complete</span>`
      : `<span class="progress">Rev ${done + 1}/${total}</span>`;

  // Next revision date label
  const next = nextRevisionDate(problem);
  const nextLabel = next
    ? `<span class="next-date">Next: ${next}</span>`
    : `<span class="next-date done-text">All revisions done</span>`;

  const { cls: platformCls, label: platformLabel } = platformInfo(problem.platform);

  card.innerHTML = `
    <div class="card-top">
      <span class="platform-badge ${platformCls}" title="${problem.platform || "LeetCode"}">${platformLabel}</span>
      <span class="diff-badge ${diffClass(problem.difficulty)}">${problem.difficulty}</span>
      ${progressLabel}
    </div>
    <p class="card-title">${escapeHTML(problem.title)}</p>
    <div class="card-meta">
      <span class="solved-date">Solved: ${problem.dateSolved}</span>
      ${nextLabel}
    </div>
    <div class="card-actions">
      ${
        showReviseButton
          ? `<button class="btn-revise" data-url="${problem.url}" data-title="${escapeHTML(problem.title)}">Revise →</button>`
          : `<button class="btn-open" data-url="${problem.url}">Open ↗</button>`
      }
    </div>
  `;

  return card;
}

/** Minimal HTML escaping to prevent XSS */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main Render ────────────────────────────────────────────

async function renderPopup() {
  const result   = await chrome.storage.local.get("problems");
  const problems = result.problems || {};
  const list     = Object.values(problems).filter(matchesFilter);

  // ─ Due Today ─
  const dueProblems = list.filter(isDueToday);
  const dueList  = document.getElementById("due-list");
  const dueEmpty = document.getElementById("due-empty");
  const dueBadge = document.getElementById("due-count");

  dueBadge.textContent = dueProblems.length;
  dueList.innerHTML    = "";

  if (dueProblems.length === 0) {
    dueEmpty.classList.remove("hidden");
  } else {
    dueEmpty.classList.add("hidden");
    dueProblems.forEach((p) => dueList.appendChild(buildCard(p, true)));
  }

  // ─ All Problems ─
  const allList  = document.getElementById("all-list");
  const allEmpty = document.getElementById("all-empty");
  const allBadge = document.getElementById("total-count");

  allBadge.textContent = list.length;
  allList.innerHTML    = "";

  // Sort: most recently solved first
  const sorted = [...list].sort((a, b) => (b.dateSolved > a.dateSolved ? 1 : -1));

  if (sorted.length === 0) {
    allEmpty.classList.remove("hidden");
  } else {
    allEmpty.classList.add("hidden");
    sorted.forEach((p) => allList.appendChild(buildCard(p, false)));
  }

  // Attach click listeners after rendering
  attachListeners();
}

// ── Event Listeners ────────────────────────────────────────

function attachListeners() {
  // "Open" buttons (all-problems section) — just open the URL
  document.querySelectorAll(".btn-open").forEach((btn) => {
    btn.addEventListener("click", () => {
      chrome.tabs.create({ url: btn.dataset.url });
    });
  });

  // "Revise" buttons — open URL then show recall modal
  document.querySelectorAll(".btn-revise").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Open the problem tab
      chrome.tabs.create({ url: btn.dataset.url });
      // Show the recall modal
      openRecallModal(btn.dataset.url, btn.dataset.title);
    });
  });
}

// ── Platform Filter Tabs ─────────────────────────────────────

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activePlatformFilter = btn.dataset.platform;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderPopup();
  });
});

// ── Recall Modal ────────────────────────────────────────────

let pendingRecallUrl = null;

function openRecallModal(url, title) {
  pendingRecallUrl = url;
  document.getElementById("modal-problem-title").textContent = title;
  document.getElementById("recall-modal").classList.remove("hidden");
}

function closeRecallModal() {
  pendingRecallUrl = null;
  document.getElementById("recall-modal").classList.add("hidden");
}

// Rating buttons (Easy / Medium / Hard)
document.querySelectorAll(".recall-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!pendingRecallUrl) return;

    const rating = btn.dataset.rating;

    await chrome.runtime.sendMessage({
      type: "RECALL_RATING",
      data: { url: pendingRecallUrl, rating },
    });

    closeRecallModal();
    await renderPopup(); // refresh the UI
  });
});

// Cancel button
document.getElementById("modal-cancel").addEventListener("click", closeRecallModal);

// Close modal when clicking the backdrop
document.getElementById("recall-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("recall-modal")) {
    closeRecallModal();
  }
});

// ── Init ───────────────────────────────────────────────────
renderPopup();
