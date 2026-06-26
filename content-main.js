// MAIN world content script — document_start, all_frames, match_about_blank.

(function () {
  const STORAGE_KEY = 'gdocspf_settings';

  function getSettings() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  // ── Action → Google Docs keyboard shortcut (Mac) ──────────────────────────
  const ACTION_SPEC = {
    h1:     { kc: 49, key: '1', code: 'Digit1', meta: true, alt: true,  shift: false },
    h2:     { kc: 50, key: '2', code: 'Digit2', meta: true, alt: true,  shift: false },
    h3:     { kc: 51, key: '3', code: 'Digit3', meta: true, alt: true,  shift: false },
    h4:     { kc: 52, key: '4', code: 'Digit4', meta: true, alt: true,  shift: false },
    normal: { kc: 48, key: '0', code: 'Digit0', meta: true, alt: true,  shift: false },
    bullet: { kc: 56, key: '*', code: 'Digit8', meta: true, alt: false, shift: true  },
  };

  function buildKeyMap(shortcuts) {
    const m = {};
    for (const [action, key] of Object.entries(shortcuts || {})) {
      if (key) m[key.toLowerCase()] = action;
    }
    return m;
  }

  function fireShortcut(action) {
    const s = ACTION_SPEC[action];
    if (!s) return;
    const opts = {
      bubbles: true, cancelable: true,
      metaKey: s.meta, altKey: s.alt, shiftKey: s.shift, ctrlKey: false,
      key: s.key, code: s.code, keyCode: s.kc, which: s.kc,
    };
    const target = document.activeElement || document.body;
    target.dispatchEvent(new KeyboardEvent('keydown', opts));
    target.dispatchEvent(new KeyboardEvent('keyup',   opts));
  }

  // ── Menu navigation ───────────────────────────────────────────────────────

  function findMenuBarButton(topDoc, label) {
    const hits = [...topDoc.querySelectorAll('*')].filter(el => {
      if (!el.offsetParent) return false;
      const r = el.getBoundingClientRect();
      return r.top <= 80 && r.height > 0 && el.textContent.trim() === label;
    });
    if (!hits.length) return null;
    return hits.reduce((a, b) => (b.contains(a) ? a : b));
  }

  function findOpenMenuItem(topDoc, label) {
    const hits = [...topDoc.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top > 80 &&
             el.textContent.trim().startsWith(label);
    });
    if (!hits.length) return null;
    return hits.reduce((a, b) => (b.contains(a) ? a : b));
  }

  function clickEl(el) {
    for (const t of ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0, buttons: 1 }));
    }
  }

  async function clickMenuPath(labels) {
    const topDoc = window.top.document;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const el = i === 0
        ? findMenuBarButton(topDoc, label)
        : findOpenMenuItem(topDoc, label);
      if (!el) { console.warn('[GDocsPF] menu item not found:', label); return false; }
      clickEl(el);
      await new Promise(r => setTimeout(r, 400));
    }
    return true;
  }

  // ── Remove all spacing (Before + After → 0) ───────────────────────────────

  // Google Docs' Custom spacing dialog uses Material Web Components whose
  // <input> elements live inside shadow roots — querySelectorAll('input') misses
  // them.  We pierce one level of shadow DOM to find them.
  function findVisibleInputs(root) {
    const all = [...root.querySelectorAll('input')];
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) all.push(...el.shadowRoot.querySelectorAll('input'));
    }
    return all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  async function removeAllSpacing() {
    const ok = await clickMenuPath(['Format', 'Line & paragraph spacing', 'Custom spacing']);
    if (!ok) return;
    await new Promise(r => setTimeout(r, 800));

    const topDoc = window.top.document;
    const inputs  = findVisibleInputs(topDoc);

    if (inputs.length < 2) { console.warn('[GDocsPF] spacing inputs not found, found:', inputs.length); return; }

    // The dialog has: Line spacing | Before | After  — last two are Before/After.
    const targets = [inputs[inputs.length - 2], inputs[inputs.length - 1]];
    const setter  = Object.getOwnPropertyDescriptor(window.top.HTMLInputElement.prototype, 'value')?.set;

    for (const inp of targets) {
      inp.focus();
      await new Promise(r => setTimeout(r, 60));
      // Native setter so React/Closure onChange fires correctly.
      if (setter) setter.call(inp, '0'); else inp.value = '0';
      inp.dispatchEvent(new InputEvent('input',  { bubbles: true, composed: true, data: '0', inputType: 'insertText' }));
      inp.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      // execCommand as belt-and-suspenders: selects all then inserts '0'.
      try { topDoc.execCommand('selectAll', false, null); topDoc.execCommand('insertText', false, '0'); } catch {}
      await new Promise(r => setTimeout(r, 80));
    }

    // Find Apply button by its visible text, then use elementFromPoint to get
    // the exact rendered element at that position — this pierces shadow DOM
    // automatically without needing to know the internal component structure.
    const applyHost = [...topDoc.querySelectorAll('*')].find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /^apply$/i.test(el.textContent.trim());
    });

    if (applyHost) {
      const br = applyHost.getBoundingClientRect();
      const cx  = (br.left + br.right)  / 2;
      const cy  = (br.top  + br.bottom) / 2;
      const actual = topDoc.elementFromPoint(cx, cy) ?? applyHost;
      actual.focus();
      await new Promise(r => setTimeout(r, 50));
      actual.click();
    } else {
      const active = topDoc.activeElement || targets[1];
      active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
    }
  }

  // ── Bullet fixer ──────────────────────────────────────────────────────────
  // User selects a block: line 1 = plain text, lines 2-N = existing bullets.
  // Strategy: document.execCommand('copy') fires Google Docs' 'copy' event
  // synchronously within the trusted keypress context, writing the selection
  // to clipboard so we can count lines.  Then we make line 1 a bullet and
  // Tab each remaining line individually — preserving the original hierarchy.

  async function fixBullets() {
    const el  = () => document.activeElement || document.body;
    const key = (opts) =>
      el().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts }));

    // execCommand('copy') must run before any await so it stays within the
    // user-gesture context (needed for clipboard write permission).
    const copied = document.execCommand('copy');
    await new Promise(r => setTimeout(r, 150));

    let lineCount = 0;
    if (copied) {
      try {
        const clip = await navigator.clipboard.readText();
        lineCount = clip ? clip.split('\n').filter(l => l.trim()).length : 0;
      } catch {}
    }

    if (lineCount < 2) {
      console.warn('[GDocsPF] select the block first (could not read selection)');
      return;
    }

    // Collapse to selection start (line 1).
    key({ key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 });
    await new Promise(r => setTimeout(r, 150));

    // Apply bullet ONLY to line 1 — existing bullets keep their levels.
    key({ key: '*', code: 'Digit8', keyCode: 56, metaKey: true, shiftKey: true });
    await new Promise(r => setTimeout(r, 250));

    // Move to line 2.
    key({ key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
    await new Promise(r => setTimeout(r, 80));

    // Tab each remaining line individually — preserves original hierarchy.
    // Home before Tab is critical: ArrowDown lands at the same visual column as
    // the previous line (mid-text on shorter lines), and Tab at mid-text inserts
    // a literal tab character instead of indenting the list item.
    for (let i = 1; i < lineCount; i++) {
      key({ key: 'Home', code: 'Home', keyCode: 36 });
      await new Promise(r => setTimeout(r, 40));
      key({ key: 'Tab', code: 'Tab', keyCode: 9 });
      await new Promise(r => setTimeout(r, 80));
      if (i < lineCount - 1) {
        key({ key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
        await new Promise(r => setTimeout(r, 60));
      }
    }
  }

  // ── Action dispatcher ─────────────────────────────────────────────────────

  async function fireAction(action) {
    if (action === 'removeSpace') {
      await removeAllSpacing();
    } else if (action === 'bulletFixer') {
      await fixBullets();
    } else {
      fireShortcut(action);
    }
  }

  // ── Keydown handler ───────────────────────────────────────────────────────

  function onKeydown(e) {
    if (!e.isTrusted) return;
    const cfg = getSettings();
    if (!cfg?.enabled) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const action = buildKeyMap(cfg.shortcuts)[e.key.toLowerCase()];
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    fireAction(action);
  }

  // ── Paste handler (image resize) ──────────────────────────────────────────

  async function onPaste(e) {
    if (!e.isTrusted) return;
    const cfg = getSettings();
    if (!cfg?.enabled) return;
    if (!e.clipboardData) return;

    const imgItem = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
    if (!imgItem) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const file = imgItem.getAsFile();
    if (!file) return;

    try {
      const blob = await resizeImage(file, cfg.imageWidth || 400);
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const topDoc = window.top.document;
        const target = topDoc.activeElement || topDoc.body;
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'v', code: 'KeyV', keyCode: 86, which: 86,
          metaKey: true, bubbles: true, cancelable: true,
        }));
      } catch {
        const dataUrl = await blobToDataUrl(blob);
        document.execCommand('insertImage', false, dataUrl);
      }
    } catch (err) { console.error('[GDocsPF] image paste:', err); }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function resizeImage(file, targetWidth) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    URL.revokeObjectURL(url);
    const c = document.createElement('canvas');
    c.width  = targetWidth;
    c.height = Math.round(targetWidth * img.naturalHeight / img.naturalWidth);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/png'));
  }

  function blobToDataUrl(blob) {
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  }

  // ── Monkey-patch addEventListener ─────────────────────────────────────────

  const _orig = EventTarget.prototype.addEventListener;
  const _done = new WeakMap();

  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'keydown' || type === 'paste') {
      if (!_done.has(this)) _done.set(this, new Set());
      const seen = _done.get(this);
      if (!seen.has(type)) {
        seen.add(type);
        _orig.call(this, type, type === 'keydown' ? onKeydown : onPaste, true);
      }
    }
    return _orig.call(this, type, fn, opts);
  };

  _orig.call(window, 'keydown', onKeydown, true);
  _orig.call(window, 'paste',   onPaste,   true);
})();
