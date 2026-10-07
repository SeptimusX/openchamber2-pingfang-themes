// OpenChamber 2 install helper (Windows).
//
// Does three things:
//   1) copies themes/*.json            -> %USERPROFILE%\.config\openchamber\themes\
//   2) patches OpenChamber's renderer  -> adds "PingFang SC (苹方)" / "PingFang Mono SC"
//      bundle (web-dist/assets/index-*.js)   font entries and shrinks desktop UI type one
//                                          step below chat type (chat stays 0.875rem)
//   3) presets Interface Font / Code Font / light+dark theme in OpenChamber's settings
//
// Idempotent: re-run after every OpenChamber update. A backup of every bundle it touches
// is written to ./backups/ next to this file.
//
// Usage:  node install.cjs
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

// anchors found in the OpenChamber 2 bundle
const UI_ENTRY = `{id:"system",label:"System",description:"Native operating system interface font.",stack:'-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'}`;
const UI_ENTRY_PATCHED = UI_ENTRY + `,{id:"${FONT_ID_UI}",label:"PingFang SC (苹方)",description:"PingFang SC (苹方) - local system font.",stack:'${SANS_STACK}'}`;
const MONO_ENTRY = `{id:"system-mono",label:"System Mono",description:"Native operating system monospace font.",stack:'ui-monospace, "SFMono-Regular", "Menlo", "Cascadia Mono", "Segoe UI Mono", monospace'}`;
const MONO_ENTRY_PATCHED = MONO_ENTRY + `,{id:"${FONT_ID_MONO}",label:"PingFang Mono SC",description:"PingFang Mono SC - local system monospace font.",stack:'${MONO_STACK}'}`;
const SCALE_OLD = `{markdown:"0.875rem",code:"0.75rem",uiHeader:"0.875rem",uiLabel:"0.84375rem",meta:"0.8125rem",micro:"0.8125rem",settingsPageTitle:"1.0625rem"}`;
const SCALE_NEW = `{markdown:"0.875rem",code:"0.75rem",uiHeader:"0.8125rem",uiLabel:"0.75rem",meta:"0.75rem",micro:"0.6875rem",settingsPageTitle:"1rem"}`;

const log = (...a) => console.log(...a);

// ---- 1) themes --------------------------------------------------------------------
fs.mkdirSync(themesDest, { recursive: true });
for (const f of fs.readdirSync(themesSrc).filter((f) => f.endsWith('.json'))) {
  fs.copyFileSync(path.join(themesSrc, f), path.join(themesDest, f));
  log('+ theme installed:', f);
}

// ---- 2) app patch -----------------------------------------------------------------
if (!fs.existsSync(assetsDir)) {
  log('! OpenChamber assets not found at', assetsDir);
  log('  set OPENCHAMBER_RESOURCES to ...\\resources and re-run to apply the font/type patch.');
} else {
  const bundles = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f));
  let touched = false;
  for (const file of bundles) {
    const full = path.join(assetsDir, file);
    let src = fs.readFileSync(full, 'utf8');
    if (!src.includes(UI_ENTRY) && !src.includes(UI_ENTRY_PATCHED)) continue; // not the bundle
    const before = src;
    const needsFonts = !src.includes(`id:"${FONT_ID_UI}"`);
    const needsScale = !src.includes(SCALE_NEW);
    if ((needsFonts || needsScale) && !fs.existsSync(path.join(backupDir, file))) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.copyFileSync(full, path.join(backupDir, file));
      log('+ backup ->', path.join('backups', file));
    }
    if (needsFonts) {
      if (!src.includes(UI_ENTRY) || !src.includes(MONO_ENTRY)) {
        log('! font registry anchors not found in', file, '- OpenChamber may have changed. Skipping.');
        continue;
      }
      src = src.replace(UI_ENTRY, UI_ENTRY_PATCHED).replace(MONO_ENTRY, MONO_ENTRY_PATCHED);
      log('+ font entries added to', file);
    }
    if (needsScale) {
      if (!src.includes(SCALE_OLD)) {
        log('! typography scale anchor not found in', file, '- OpenChamber may have changed. Skipping.');
        continue;
      }
      src = src.replace(SCALE_OLD, SCALE_NEW);
      log('+ desktop UI type shrunk in', file);
    }
    if (src !== before) { fs.writeFileSync(full, src, 'utf8'); touched = true; }
    else log('= already patched:', file);
  }
  if (!touched) log('= bundle already patched');
}

// ---- 3) settings ------------------------------------------------------------------
const now = Date.now();
const prefs = {
  uiFont: FONT_ID_UI,
  monoFont: FONT_ID_MONO,
  lightThemeId: 'pingfang-mono-plus-light',
  darkThemeId: 'pingfang-mono-plus-dark',
};

const pp = path.join(configDir, 'preferences.json');
if (fs.existsSync(pp)) {
  let p = fs.readFileSync(pp, 'utf8');
  for (const [key, value] of Object.entries(prefs)) {
    const re = new RegExp('("' + key + '":\\s*\\{\\s*"updatedAt":\\s*)\\d+(,\\s*"value":\\s*)"[^"]*"');
    if (re.test(p)) p = p.replace(re, '$1' + now + '$2"' + value + '"');
  }
  fs.writeFileSync(pp, p, 'utf8');
  log('+ preferences.json updated');
}

const sp = path.join(configDir, 'settings.json');
if (fs.existsSync(sp)) {
  let s = fs.readFileSync(sp, 'utf8');
  for (const [key, value] of Object.entries(prefs)) {
    const re = new RegExp('"' + key + '"\\s*:\\s*"[^"]*"');
    if (re.test(s)) s = s.replace(re, '"' + key + '": "' + value + '"');
  }
  fs.writeFileSync(sp, s, 'utf8');
  log('+ settings.json updated');
}

log('\nDone. Restart OpenChamber to apply (the desktop window reads web-dist from disk).');
log('After restart confirm: Interface Font = PingFang SC (苹方), Code Font = PingFang Mono SC,');
log('Theme = Mono Plus PingFang (light/dark), and UI text one step smaller than chat text.');
