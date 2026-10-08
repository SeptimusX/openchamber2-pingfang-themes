// OpenChamber 2 install helper (Windows).
//
// Does three things:
//   1) copies themes/*.json            -> %USERPROFILE%\.config\openchamber\themes\
//   2) patches OpenChamber's renderer  -> adds "PingFang SC (苹方)" / "PingFang Mono SC"
//      bundle (web-dist/assets/index-*.js)   font entries and shrinks UI type one step
//                                          below chat type (chat/markdown is left alone)
//   3) presets Interface Font / Code Font / light+dark theme in OpenChamber's settings
//      (existing keys are updated, missing keys are inserted, everything else is kept)
//
// Idempotent: re-run after every OpenChamber update. A backup of every bundle it touches
// is written to ./backups/ next to this file.
//
// Usage:  node install.cjs
//         OPENCHAMBER_RESOURCES=/path/to/resources node install.cjs   (macOS/Linux)
const fs = require('fs');
const path = require('path');

const here = __dirname;
const themesSrc = path.join(here, 'themes');
const backupDir = path.join(here, 'backups');
const configDir = path.join(process.env.USERPROFILE, '.config', 'openchamber');
const themesDest = path.join(configDir, 'themes');

const APP_RESOURCES =
  process.env.OPENCHAMBER_RESOURCES ||
  path.join(process.env.LOCALAPPDATA || '', 'Programs', '@openchamberelectron', 'resources');
const assetsDir = path.join(APP_RESOURCES, 'web-dist', 'assets');

const FONT_ID_UI = 'pingfang';
const FONT_ID_MONO = 'pingfang-mono';

const SANS_STACK =
  '"PingFang SC", "苹方-简", "萍方-簡", "苹方-简 常规体", "萍方-簡 常規體", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif';
const MONO_STACK =
  '"PingFang Mono SC", "PingFang Mono SC Mod3", "SFMono-Regular", "Menlo", "Consolas", monospace';

const UI_ENTRY_NEW =
  `{id:"${FONT_ID_UI}",label:"PingFang SC (苹方)",description:"PingFang SC (苹方) - local system font.",stack:'${SANS_STACK}'}`;
const MONO_ENTRY_NEW =
  `{id:"${FONT_ID_MONO}",label:"PingFang Mono SC",description:"PingFang Mono SC - local system monospace font.",stack:'${MONO_STACK}'}`;

// The font registry entries we anchor on. Only these ids are stable across builds --
// labels/descriptions/stacks may be reworded, and minified variable names may change.
const UI_ANCHOR_ID = 'system';
const MONO_ANCHOR_ID = 'system-mono';

// UI type, one step below chat type (markdown/code are never touched).
const SCALE_TARGETS = {
  uiHeader: '0.8125rem', // 13px
  uiLabel: '0.75rem', //   12px
  meta: '0.75rem', //      12px
  micro: '0.6875rem', //   11px
  settingsPageTitle: '1rem', // 16px
};

const log = (...a) => console.log(...a);

// ---- 1) themes --------------------------------------------------------------------
fs.mkdirSync(themesDest, { recursive: true });
for (const f of fs.readdirSync(themesSrc).filter((f) => f.endsWith('.json'))) {
  fs.copyFileSync(path.join(themesSrc, f), path.join(themesDest, f));
  log('+ theme installed:', f);
}

// ---- 2) app patch -----------------------------------------------------------------

// A flat (brace-free) object literal whose first property is `id: "<value>"`.
// Deliberately ignores labels/descriptions/stacks and whitespace, so reworded
// entries or a different minifier output still match.
function findEntryLiteral(src, id) {
  const re = new RegExp('\\{[^{}]*\\bid["\']?\\s*:\\s*["\']' + id + '["\'][^{}]*\\}');
  const m = re.exec(src);
  return m ? { start: m.index, end: m.index + m[0].length, text: m[0] } : null;
}

// Rewrite the value of `key` inside a flat object literal, preserving its quoting style.
function setLiteralProp(literal, key, value) {
  const re = new RegExp('(\\b' + key + '\\s*:\\s*)(["\'])(?:[^"\'\\\\]|\\\\.)*\\2');
  if (!re.test(literal)) return { literal, changed: false, found: false };
  const next = literal.replace(re, (m, pre, quote) => pre + quote + value + quote);
  return { literal: next, changed: next !== literal, found: true };
}

// Typography scale presets are brace-free object literals that declare `markdown`
// and `settingsPageTitle` next to CSS length strings. We find them by content, not by
// the minified variable name they are assigned to, and shrink the UI keys in place.
function patchTypeScales(src) {
  let patched = 0;
  let seen = 0;
  const out = src.replace(/\{[^{}]*\}/g, (literal) => {
    if (!/\bmarkdown\s*:/.test(literal)) return literal;
    if (!/\bsettingsPageTitle\s*:/.test(literal)) return literal;
    if (!/\buiHeader\s*:/.test(literal)) return literal;
    seen += 1;
    let next = literal;
    let changed = false;
    for (const [key, value] of Object.entries(SCALE_TARGETS)) {
      const r = setLiteralProp(next, key, value);
      next = r.literal;
      if (r.changed) changed = true;
    }
    if (changed) patched += 1;
    return next;
  });
  return { src: out, seen, patched };
}

// Insert a registry entry right after the entry with `anchorId`.
function addFontEntry(src, anchorId, newEntry) {
  const anchor = findEntryLiteral(src, anchorId);
  if (!anchor) return null;
  return src.slice(0, anchor.end) + ',' + newEntry + src.slice(anchor.end);
}

if (!fs.existsSync(assetsDir)) {
  log('! OpenChamber assets not found at', assetsDir);
  log('  set OPENCHAMBER_RESOURCES to ...\\resources and re-run to apply the font/type patch.');
} else {
  const bundles = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f));
  let touched = false;
  for (const file of bundles) {
    const full = path.join(assetsDir, file);
    const before = fs.readFileSync(full, 'utf8');
    // The renderer bundle is the one holding the font registry.
    if (!findEntryLiteral(before, UI_ANCHOR_ID) || !findEntryLiteral(before, MONO_ANCHOR_ID)) continue;

    let src = before;

    // --- font entries
    const hasUi = src.includes(`id:"${FONT_ID_UI}"`);
    const hasMono = src.includes(`id:"${FONT_ID_MONO}"`);
    if (!hasUi) {
      const next = addFontEntry(src, UI_ANCHOR_ID, UI_ENTRY_NEW);
      if (next === null) log(`! UI font anchor (id:"${UI_ANCHOR_ID}") not found in ${file} - skipping`);
      else src = next;
    }
    if (!hasMono) {
      const next = addFontEntry(src, MONO_ANCHOR_ID, MONO_ENTRY_NEW);
      if (next === null) log(`! mono font anchor (id:"${MONO_ANCHOR_ID}") not found in ${file} - skipping`);
      else src = next;
    }
    if (src !== before) log(`+ font entries (${FONT_ID_UI} / ${FONT_ID_MONO}) added to ${file}`);
    else log(`= font entries already present in ${file}`);

    // --- UI type scale
    const scale = patchTypeScales(src);
    if (scale.seen === 0) {
      log(`! no typography scale preset found in ${file} - skipping the type patch`);
    } else if (scale.patched === 0) {
      log(`= type scale already patched in ${file} (${scale.seen} preset(s))`);
    } else {
      src = scale.src;
      log(`+ UI type shrunk in ${file} (${scale.patched}/${scale.seen} preset(s))`);
    }

    if (src === before) {
      log(`= already patched: ${file}`);
      continue;
    }
    if (!fs.existsSync(path.join(backupDir, file))) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(full, path.join(backupDir, file));
      log('+ backup ->', path.join('backups', file));
    }
    fs.writeFileSync(full, src, 'utf8');
    touched = true;
  }
  if (!touched) log('= bundle already patched');
}

// ---- 3) settings ------------------------------------------------------------------
// Merge the desired values in: keys that exist are updated, missing keys are inserted,
// everything else (other fields, per-surface overrides, value/surfaces shapes) is kept.
const now = Date.now();
const desired = {
  uiFont: FONT_ID_UI,
  monoFont: FONT_ID_MONO,
  lightThemeId: 'pingfang-mono-plus-light',
  darkThemeId: 'pingfang-mono-plus-dark',
};

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    log(`! ${path.basename(file)} is not valid JSON (${e.message}) - leaving it alone`);
    return false;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// settings.json: flat base values.
const settingsFile = path.join(configDir, 'settings.json');
const settings = readJson(settingsFile);
if (settings === false) {
  // unreadable: skip
} else {
  const target = settings || {};
  let changed = 0;
  for (const [key, value] of Object.entries(desired)) {
    if (target[key] !== value) {
      const had = Object.prototype.hasOwnProperty.call(target, key);
      target[key] = value;
      changed += 1;
      log(`  ${had ? '~' : '+'} settings.json ${key} = ${value}`);
    }
  }
  if (changed) {
    writeJson(settingsFile, target);
    log(`+ settings.json updated (${changed} field(s))`);
  } else {
    log('= settings.json already set');
  }
}

// preferences.json: { version, fields: { key: { updatedAt, value[, surfaces] } } }
const prefsFile = path.join(configDir, 'preferences.json');
const prefs = readJson(prefsFile);
if (prefs === false) {
  // unreadable: skip
} else {
  const target = prefs || {};
  if (!target.fields || typeof target.fields !== 'object' || Array.isArray(target.fields)) {
    target.fields = {};
  }
  if (target.version === undefined) target.version = 1;
  let changed = 0;
  for (const [key, value] of Object.entries(desired)) {
    const current = target.fields[key];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      target.fields[key] = { updatedAt: now, value };
      changed += 1;
      log(`  + preferences.json ${key} = ${value}`);
      continue;
    }
    if (current.value !== value) {
      current.value = value;
      current.updatedAt = now;
      changed += 1;
      log(`  ~ preferences.json ${key} = ${value}`);
    }
  }
  if (changed) {
    writeJson(prefsFile, target);
    log(`+ preferences.json updated (${changed} field(s))`);
  } else {
    log('= preferences.json already set');
  }
}

log('\nDone. Restart OpenChamber to apply (the desktop window reads web-dist from disk).');
log('After restart confirm: Interface Font = PingFang SC (苹方), Code Font = PingFang Mono SC,');
log('Theme = Mono Plus PingFang (light/dark), and UI text one step smaller than chat text.');
