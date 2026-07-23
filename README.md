# Code Reviser — LeetCode & HackerRank (Chrome Extension)

Spaced repetition for problems you solve on **LeetCode** and **HackerRank**.
Automatically schedules reviews at **Day 3 → 7 → 14 → 30** after you solve a
problem, on either site, in one shared queue.

---

## 📁 File Structure

```
leetcode-reviser/
├── manifest.json          ← Extension config (Manifest v3)
├── background.js          ← Service worker: stores problems, handles recall
├── content-leetcode.js    ← Injected into LeetCode: detects "Accepted" submissions
├── content-hackerrank.js  ← Injected into HackerRank: detects passed submissions
├── popup.html             ← Extension popup layout (+ platform filter tabs)
├── popup.js               ← Popup logic: renders due/all problems, handles modal
├── style.css              ← Dark terminal theme
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Installation (Chrome)

1. **Download / unzip** this folder so you have `leetcode-reviser/` locally.

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Enable **Developer mode** (toggle in the top-right corner).

4. Click **"Load unpacked"**.

5. Select the `leetcode-reviser/` folder.

6. The extension icon (`{CR}`) will appear in your toolbar.
   Pin it via the puzzle-piece icon for easy access.

> The icons shipped in `icons/` are simple generated placeholders —
> swap them for your own artwork any time, the manifest paths won't change.

---

## 🧠 How It Works

### Solving a Problem

**LeetCode**
- Navigate to any LeetCode problem (e.g. `leetcode.com/problems/two-sum/`).
- Submit your solution. When the result shows **"Accepted"**, the content
  script detects it and automatically saves the problem, tagged `LeetCode`.

**HackerRank**
- Navigate to any HackerRank challenge (e.g.
  `hackerrank.com/challenges/<slug>/problem`, including contest URLs like
  `hackerrank.com/contests/<contest>/challenges/<slug>/problem`).
- Submit your solution. When the result indicates all test cases passed
  (e.g. "All test cases passed!" or "N/N Test Cases"), the content script
  detects it and saves the problem, tagged `HackerRank`.

Either way, revision dates are generated: **+3, +7, +14, +30 days** from
today, and the problem lands in the same shared queue.

### Daily Revision
- Click the extension icon to open the popup.
- Use the **All / LeetCode / HackerRank** tabs at the top to filter the
  queue by platform, or leave it on **All** to see everything together.
- **"Due Today"** shows all problems whose next revision date is today
  (or overdue from previous days).
- Click **"Revise →"** to open the problem in a new tab.
- A modal appears asking how well you recalled it:
  - 😄 **Easy** → advance to the next revision slot
  - 😐 **Medium** → advance to the next revision slot
  - 😓 **Hard – Reset** → restart the revision cycle from today

### All Problems
- The **"All Problems"** section shows every saved problem — from both
  platforms — with a small `LC` / `HR` badge, current revision progress,
  and next scheduled date.

---

## 📊 Spaced Repetition Schedule

| Revision | Days After Solving |
|----------|--------------------|
| 1st      | Day 3              |
| 2nd      | Day 7              |
| 3rd      | Day 14             |
| 4th      | Day 30             |

If you rate a revision as **Hard**, the cycle resets from the current date.

---

## 🛠 Troubleshooting

**Problem not being saved after solving (LeetCode):**
- Make sure you are on a `leetcode.com/problems/...` URL.
- The content script uses a MutationObserver watching for the word
  "Accepted" — if LeetCode's DOM changes, check `nodeContainsAccepted`
  in `content-leetcode.js`.

**Problem not being saved after solving (HackerRank):**
- Make sure you are on a `hackerrank.com/challenges/...` (or
  `.../contests/*/challenges/...`) URL.
- HackerRank's editor UI changes its class names more often than
  LeetCode's. The detection heuristics live in `nodeIndicatesSuccess`
  in `content-hackerrank.js` — open DevTools on the results panel after
  a passing submission, find the element/class that shows the "all
  passed" state, and add a matching check there.
- As a quick sanity check, open the service worker console
  (`chrome://extensions` → **"Service worker"**) and watch for the
  `[Code Reviser] Detected accepted submission (HackerRank)` log line
  when you submit — if it never appears, the detector isn't matching.

**Popup shows 0 problems:**
- Open `chrome://extensions` → click the extension's **"Service worker"** link
  → check the console for errors.
- Also check the platform filter tabs aren't stuck on a platform with
  no saved problems yet.

**Reset all data:**
- Open the Chrome DevTools console on any page and run:
  ```js
  chrome.storage.local.clear()
  ```

---

## 🔧 Customization

- **Change intervals:** Edit the `intervals` array in `background.js`:
  ```js
  const intervals = [3, 7, 14, 30]; // days
  ```
- **Add more problems manually:** Use `chrome.storage.local.get("problems")`
  in the DevTools console to inspect / edit stored data. Each entry now
  also has a `platform` field (`"LeetCode"` or `"HackerRank"`).
- **Tune HackerRank detection:** see the Troubleshooting section above —
  this is the one part of the extension most likely to need occasional
  updates, since HackerRank's editor DOM isn't as stable as LeetCode's.
