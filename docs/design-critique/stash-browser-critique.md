# Design Critique: Stash / File Browser

*Stashly · reviewed live on localhost at 1440 / 1280 / 768 / 375 px · Home, All, `.claude` folder · grid + list layouts · 24 Sep 2026*

## Overall Impression

The stash has a real identity: the folder-tab cards, the monochrome mono type and the storage summary all feel like one product. The biggest gaps are outside the 1280px desktop frame and outside the mouse. Below about 840px the toolbar and grid run off-screen, and cards and rows can't be opened from the keyboard.

**Findings:** 4 critical · 5 moderate · 4 minor

## Usability

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| **Toolbar and grid overflow below ~840px.** At 768px the document is 838px wide. Sort direction, grid/list toggle, theme, notifications and account sit past the right edge, and the third grid column is cut off. | 🔴 Critical | Let the toolbar wrap to two rows, or collapse Filter/Sort/View into one "View options" popover under ~900px. Switch the grid to `repeat(auto-fill, minmax(220px, 1fr))` so columns drop instead of clipping. |
| **No navigation on phones.** At 375px the sidebar is hidden with nothing replacing it. Images, Collections, Favorites, Shared and Trash can't be reached. The page also lays out at ~770px, so it renders zoomed out. | 🔴 Critical | Add a hamburger that opens the sidebar as a sheet, or a bottom tab bar with Home / All / Search / More. Fix the min-width that forces the 770px layout viewport. |
| **List layout inside a folder is blank.** `/folders/…?layout=list` for `.claude` shows the header (3 files, 3 folders) and no rows, including after a full reload. Grid shows all 6 items. | 🔴 Critical | Fix the data path for list in folder routes. Also add an empty state ("This folder is empty · Upload") so a failure never looks like an empty folder. |
| **Root "All" count doesn't match what's shown.** Chips read 36 files · 28 folders, and the page shows one folder. The chips are recursive totals, but they sit where "this folder" counts sit elsewhere. | 🟡 Moderate | At the root, show direct children ("1 folder") and move totals to a label like "527 KB across 64 items". Keep one meaning per chip position. |
| **Files sort before folders.** Sorted by Name, `.claude` lists settings.json, settings.local.json, tsc-baseline.json, then evidence, hooks, skills. | 🟡 Moderate | Put folders first by default (Finder, Drive and Explorer all do). Make it a toggle if you want mixed sorting. |
| **Truncation hides extensions.** "settings.local.…" and "tsc-baseline.js…" lose the part that tells you the file type. In the root list, all 8 image names shorten to the same "Gemini_Generate…". | 🟡 Moderate | Truncate in the middle and keep the extension: `settings.lo….json`. Show the full name in a tooltip. |
| **Search appears twice.** A search field in the toolbar and a search icon at the right of the breadcrumb row. | 🟢 Minor | If the second one scopes to the current folder, label it "Search in .claude". If not, remove it. |
| **"1 items"** on the hooks folder card. | 🟢 Minor | Use `Intl.PluralRules` or a small plural helper. |

## Visual Hierarchy

- **What draws the eye first**: On folder cards it's the 30px size figure ("252 KB"). The folder name is 18px. When you browse, the name is what you look for, and size matters mostly on the Storage page.
- **Reading flow**: The home page works well: greeting, stash name, storage bar, suggested folders, recently opened. Inside a folder, the white code previews on file cards are the brightest things on a near-black page, so they pull focus away from the folders.
- **Emphasis**: Folder cards leave about half their height empty. On phones one card fills most of the screen. Use that space for a peek at the contents (2–3 thumbnails or file-type glyphs), or shorten the card so more fit.
- **Suggested fix**: Name 18px → primary; size and item count on one 12px meta line; date on hover or in list view only. Render text/code previews on a dark surface in dark mode.

## Consistency

| Element | Issue | Recommendation |
|---------|-------|----------------|
| Filter control | The lock and favorite toggles are buttons nested inside the Filter button. That's invalid HTML, and it's what triggers the hydration error in the console on every load. | Make the trigger and the toggles siblings in a group container. |
| File vs folder cards | Different anatomy: files put the meta on one line under the preview, folders stack name, date, size and count. | Share one meta line layout: name, then `size · count/date`. |
| Selection checkbox | The select-all box next to the back arrow is an unlabeled grey square at rest. It reads as a missing avatar. | Show a checkbox outline with a "Select" label, or show it only once something is selected. |
| Breadcrumb | Only the current folder name shows, so the path is lost after two levels. | Show the full path (`All / .claude / skills`) with each part as a link. |

## Accessibility

- **Opening items by keyboard — 🔴 Fail**: Grid cards are `div onClick` and list rows are `tr onClick`, with no focusable element inside. Keyboard and screen-reader users can't open any file or folder. Middle-click and "open in new tab" don't work either. Wrap the card name in a real `<a href>` and stretch its hit area across the card.
- **Button names — 🟡 Fail**: 14 visible icon buttons have no accessible name: upload, the upload menu, the lock and favorite filters, the grid/list radios, theme, account, and each card's checkbox and ••• menu. Add `aria-label`s, and a tooltip for sighted users.
- **Color contrast — 🟢 Pass**: Primary text `oklch(.97)` on card `oklch(.23)` ≈ 15:1. Secondary `oklch(.68)` on `.23` ≈ 5.9:1 and on `.18` ≈ 6.5:1. All pass AA.
- **Touch targets — 🟡 Below 44px**: Toolbar buttons are 36px, the fuzzy/semantic toggles 32×24, checkboxes 24px. Fine with a mouse, tight on touch. Pad hit areas to 44px under a `pointer: coarse` query.
- **Text readability — 🟢 Minor**: Everything is Share Tech Mono, and 12px is the most common size (81 text nodes on Home). Mono at 12px is slow to scan. Keep the mono for labels and numbers, and use a humanist sans at 13–14px for file names and body.
- **Headings — 🟢 Minor**: The folder page has no h1 or h2, so screen-reader heading navigation finds nothing. Make the folder name the h1.

## What Works Well

- **The folder-tab card**: a recognizable shape that only Stashly has. It carries the brand without adding color.
- **Storage summary**: used/total, a per-type breakdown with colored dots, and "Manage plan" right beside it. Clear and actionable.
- **Search mode toggle**: putting fuzzy/semantic inside the search field shows the AI feature at the moment you need it.
- **Explicit sort**: "Name" plus a direction toggle with a descriptive label is better than a bare icon.
- **Content previews**: real file contents in thumbnails make files easy to tell apart at a glance.
- **Restraint**: a monochrome palette with healthy contrast leaves room for semantic color later.

## Priority Recommendations

1. **Make every item a real link and name every icon button**: This is the cheapest change with the widest effect. It fixes keyboard access, screen readers, middle-click and cmd-click in one pass. Remove the nested buttons in Filter at the same time, which also clears the hydration error.
2. **Make the shell responsive**: Wrap or collapse the toolbar under ~900px, use an auto-fill grid, and give phones a way to reach the sidebar sections. Right now the stash only works at desktop widths.
3. **Fix list layout in folders and add empty states**: A blank page looks the same as data loss. Any view that can be empty needs an explicit empty state with an Upload action.
4. **Rebalance the cards**: Folders first, name as the primary text, size demoted to the meta line, dark previews in dark mode, and middle truncation that keeps extensions.

---

*Method: reviewed in the browser against your signed-in dev stash (28 folders, 36 files at the time). Contrast, accessible names, target sizes and overflow were measured from the DOM. Widths were emulated in the browser pane, and the 1440px render showed no overflow. Upload, drag-and-drop, the item page, light theme and workspaces weren't covered.*
