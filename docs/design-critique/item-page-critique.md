# Design Critique: Item Page

*Stashly · reviewed live on localhost at 486 and 977 px wide · .json · .md · .jpg · .pdf · .m4a · .mkv · 24 Sep 2026*

## Overall Impression

Each file type gets a viewer built for it, and the loading, sibling navigation and video controls feel carefully made. The weak spots are the frame around the viewers. The item panel covers the file instead of making room for it, the main actions are two clicks away, and the audio and video scrubbers don't work well with a keyboard.

**Findings:** 2 critical · 7 moderate · 8 minor

## Usability

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| **The item panel covers the file.** At 977px, opening the panel on the PDF hides about 80px of the page underneath it. The third card's text ("Uploaded markdown a…") is cut off. The code viewer behaves the same way. | 🔴 Critical | Above ~1024px, dock the panel and shrink the stage so the PDF refits. Keep the overlay only for narrow screens, and add a scrim and a close button there. |
| **Audio seek bar is mouse-only and clipped.** The waveform seek has `tabindex=-1` and no `aria-valuenow`. At 486px it runs to 536px, so the total time (23:20) is off-screen and only 0:00 shows. | 🔴 Critical | Make the waveform a real slider: focusable, arrow keys seek ±5s, `aria-valuetext="3:12 of 23:20"`. Size it to its container and keep both times visible. |
| **Main actions are buried.** Favorite, Share, Download, Copy link and Add to collection only appear at the bottom of the item panel, which starts closed. The header has only the theme and panel toggles. | 🟡 Moderate | Put Download, Share and ••• in the header on every file type. Keep the full row in the panel. |
| **Floating toolbars cover content.** In the code viewer, lines 37–39 sit under the toolbar. The PDF toolbar covers the lower page. Both use `fixed left-1/2`, so they center on the window, not on the file. | 🟡 Moderate | Pad the scroll area by the toolbar's height. Position the toolbar inside the stage so it stays centered when the outline or panel opens. |
| **Code runs under the minimap.** At narrow widths, long wrapped lines continue underneath the minimap (398–454px), so the end of each line is partly hidden. | 🟡 Moderate | Hide the minimap below ~700px, or wrap at the viewport minus the minimap's width. |
| **PDF text can't be selected or searched.** Pages render as canvases with no text layer. You can't copy a sentence or use Ctrl+F. | 🟡 Moderate | Render PDF.js's text layer over each page. It also gives screen readers something to read. |
| **Zoom label says 100% at fit size.** The image is 1376px wide and drawn at 454px (about 33%), but the control reads 100%. | 🟡 Moderate | Show "Fit" at the default size and real percentages after zooming, or show the true scale. |
| **PDF page counter wraps.** "1 / 15" breaks onto two lines in the toolbar. | 🟢 Minor | Add `white-space: nowrap` and tabular numbers. |
| **Empty Tags section is a dead end.** The panel shows a TAGS heading with nothing under it. | 🟢 Minor | Add an "Add tag" button, or hide the section until a tag exists. |

## Visual Hierarchy

- **What draws the eye first**: The file itself, which is right. The chrome is quiet: a back arrow, the breadcrumb and two small buttons. The accent color is kept for the play button, which is the one action that matters on media pages.
- **Reading flow**: Header, then the file, then a floating toolbar. On media pages the "1 of 10" pill above the stage is a clear, calm way to move between files. The audio page repeats the file name (header and title) with raw underscores, which adds noise.
- **Emphasis**: Markdown prose is set in Share Tech Mono at 15px. It works for short notes but slows reading of long documents. The code spans in the same document already use JetBrains Mono, so a sans for prose would also separate prose from code more clearly.
- **Suggested fix**: Show a cleaned title on media pages ("Stashly's Zero-Server-Cost Browser Pipeline") and keep the raw filename in the header. Use a sans at 16px with a ~68ch measure for markdown prose.

## Consistency

| Element | Issue | Recommendation |
|---------|-------|----------------|
| File name | The header says `settings.json`, the panel title says `settings`. The PDF panel also drops ".pdf". | Use the full name everywhere. Extensions help people tell files apart. |
| Dates | The Details tab shows "Sep 16, 2026" and the Activity tab shows "16 Sept 2026, 06:56". | Use one formatter with one locale, and add the time only where it's needed. |
| Stage toolbars | Code, PDF and image have a floating bottom toolbar. Markdown with no headings has none, so there's no Copy button there. | Give every text stage the same base toolbar (copy, line count, panel toggle), and let each type add its own controls. |
| Right-to-left names | The video title pill forces `dir="ltr"` and the header has no `dir`. So "(Prod. By Nuri)-720p60" appears on the wrong side of a Hebrew title. | Set `dir="auto"` on every element that shows a file name. Keep `unicode-bidi: isolate`. |

## Accessibility

- **Video controls — 🟢 Pass**: Every button is labeled (Play, Back 10 seconds, Repeat, Playback speed, Fullscreen). Space, j, k, l and the arrow keys work, and they correctly stop sibling navigation from firing.
- **Video scrubber — 🟡 Partial**: The scrubber only appears on hover. Its thumb can be focused but is 0×0, so a keyboard user can't see where focus is. Show a thin progress bar at all times and grow it on hover or focus.
- **Button names — 🟡 Fail**: These have no name: the back arrow, the header's panel toggle, the audio "next" and item-panel buttons, the audio volume slider, the PDF sidebar toggle, and both panel tabs (Details and Activity). The tabs also contain nested buttons.
- **Image alt text — 🟢 Minor**: Alt text is the file name. Stashly already runs captioning models in the browser, so a generated caption could fill `alt` for images without one.
- **Touch targets — 🟢 Minor**: Panel actions are 32px, PDF reset-zoom is 34×16 and the panel tabs are 36×35. Pad them to 44px on touch screens.
- **Contrast — 🟢 Pass**: Uses the same tokens as the stash (primary ≈15:1, muted ≈6:1). The dim code under the minimap is a layering problem, not a token problem.

## What Works Well

- **Shape-matched skeleton**: the code loader draws gutter and indented line bars, so the page doesn't jump when the editor arrives.
- **Sibling navigation**: "1 of 10" moves across images and videos with the arrow keys. It replaces history entries, so Back returns to the folder.
- **Video player**: labeled controls, YouTube-style shortcuts, speed and repeat, and it plays .mkv straight from storage.
- **Audio page**: the waveform, a large accent play button and loop/previous/next make a podcast-length file feel at home.
- **Item panel content**: the fields fit the file type: page count, page size and PDF version for PDFs, plus a timeline and an activity feed.
- **Calm chrome**: one header layout (back, breadcrumb, two buttons) is shared by every file type.

## Priority Recommendations

1. **Dock the item panel on wide screens**: Let it take width from the stage instead of covering it, and refit PDFs and images when it opens. This fixes the clipped PDF and hidden code, and makes the panel something you can leave open.
2. **Put Download, Share and ••• in the header**: These are the most common things people do with an open file. Today they need a click to open the panel and a look at its bottom edge.
3. **Make the media scrubbers accessible**: Audio seek needs to be focusable with value text and fit its container. The video scrubber needs a visible at-rest state and a focus ring. Name the remaining icon buttons.
4. **Anchor toolbars to the stage**: Center them in the stage, pad content so nothing sits underneath, and hide the minimap on narrow screens.
5. **Add the PDF text layer**: Selecting, copying and finding text are expected in any PDF viewer, and it also fixes the screen-reader gap.

---

*Method: reviewed in the browser pane against your dev stash, using settings.json, claude-legacy-memory.md, a Gemini image, Stashly_Browser_IDE_Architecture.pdf, one .m4a and one Hebrew-titled .mkv. Layout, labels, focusability and overflow were measured from the DOM. The pane was 486px wide for part of the session and 977px for the rest, and each finding is reported at the width where it was measured. Load times weren't judged because this was the dev server. Editing, versions, Mermaid blocks, markdown with headings (outline rail) and the light theme weren't covered.*
