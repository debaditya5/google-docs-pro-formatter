# Google Docs Pro Formatter

A Chrome extension (Mac) that replaces multi-key Google Docs shortcuts with single configurable keys, removes paragraph spacing in one keystroke, and auto-resizes pasted images.

---

## Features

| Feature | What it does |
|---|---|
| **Heading 1–4** | Apply H1/H2/H3/H4 formatting with a single key |
| **Normal text** | Reset paragraph to Normal text style |
| **Bullet list** | Toggle bulleted list on the current paragraph |
| **Remove space** | Open Custom Spacing and set Before + After to 0 in one step |
| **Bullet fixer** | Select a block where line 1 is plain text and lines 2–N are already bulleted — makes line 1 a level-1 bullet and shifts every other line +1 indent level, preserving the full hierarchy |
| **Image resize on paste** | Automatically scales pasted images to a configurable width (default 400 px) |

All keys are fully configurable. The extension has an ON/OFF toggle so normal Google Docs typing is never interrupted when it's off.

---

## Bullet Fixer — example

**Before** (you select this entire block and press your Bullet Fixer key):

```
Applied AI PM                        ← plain text heading
• Operates at the Application layer  ← level-1 bullet
  ○ Prompt engineering               ← level-2 bullet
  ○ RAG
  ○ AI agents
• Goal: move from raw technology…
• Requires high user empathy…
• Example: The PM behind Notion AI…
```

**After**:

```
• Applied AI PM                      ← now a level-1 bullet
  ○ Operates at the Application layer ← shifted to level-2
    ■ Prompt engineering              ← shifted to level-3
    ■ RAG
    ■ AI agents
  ○ Goal: move from raw technology…  ← shifted to level-2
  ○ Requires high user empathy…
  ○ Example: The PM behind Notion AI…
```

---

## Installation

### Requirements
- macOS
- Google Chrome

### Steps

1. **Download** the latest `Google_doc_pro_formatter.zip` from the [Releases](../../releases) page (or clone this repo).

2. **Unzip** the file if you downloaded the zip.

3. Open Chrome and go to `chrome://extensions`.

4. Enable **Developer mode** (toggle in the top-right corner).

5. Click **Load unpacked** and select the `Google_doc_pro_formatter` folder.

6. The extension icon (blue ⚡) will appear in your Chrome toolbar.

---

## Configuration

Click the extension icon to open the popup:

- **Toggle** the ON/OFF switch to enable or disable all shortcuts.
- **Image width** — set the target width (in px) for pasted images.
- **Shortcut keys** — click any key field and press the key you want to assign. Conflicts are cleared automatically (one key → one action).

Default shortcuts:

| Action | Default key |
|---|---|
| Heading 1 | `Q` |
| Heading 2 | `W` |
| Heading 3 | `E` |
| Heading 4 | `R` |
| Normal text | `T` |
| Bullet list | `Y` |
| Remove space | `U` |
| Bullet fixer | *(unset)* |

---

## How it works

- **ISOLATED world** (`content.js`) — syncs settings from `chrome.storage.sync` to `sessionStorage` so the MAIN world script can read them without needing the chrome API.
- **MAIN world** (`content-main.js`) — monkey-patches `EventTarget.prototype.addEventListener` at `document_start` to register a keydown handler *before* Google Docs. Real keypresses (`isTrusted: true`) matching a configured shortcut are intercepted; synthetic events pass through untouched. Formatting is applied by dispatching synthetic `KeyboardEvent`s (e.g. `Cmd+Option+1` for H1) or by walking the Format menu DOM for actions that have no keyboard shortcut.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Save your shortcut and image-width settings |
| `clipboardWrite` | Write resized image data back to clipboard for paste |
| `clipboardRead` | Read selected text to count lines for Bullet Fixer |
