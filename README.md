# OpenChamber 2 PingFang Themes

PingFang (苹方) fonts and a slightly tighter UI for **OpenChamber 2**, on top of the built-in
**Mono Plus** colors.

基于 Mono Plus 配色的 OpenChamber 2 自定义主题：界面字体用苹方-简（PingFang SC），代码字体用
PingFang Mono SC，界面文字比聊天文字小一档。

> **Note / 说明**：OpenChamber 2 比 V1 收紧了主题能力，单靠主题 JSON 无法实现「苹方界面字体」和
> 「界面字号更小」。原因是：
> - `config.fonts.*` 的值现在禁止包含 `; { } < > \`，V1 时代用字体值注入 `--text-*` 字号的写法会
>   让整个主题被判非法（OpenChamber 会静默跳过该主题）。
> - 主题 `config` 仍然只支持 `fonts` / `transitions`，没有排版字号；设置里只有全局的
>   Interface Font Size 百分比（UI 与聊天一起缩放）。
> - 界面主体字体来自「界面字体」设置（应用以内联样式写到 `body`），主题字体只对 `.font-sans`
>   类生效，全应用仅十来处。
>
> 因此本仓库在主题之外还提供了一个小补丁，给应用加两个字体项并把桌面排版梯度里的 UI 字号降一档。

## Contents / 内容

| Path | What |
|------|------|
| `themes/pingfang-mono-plus-light.json` | Mono Plus colors, PingFang UI + code fonts (light) |
| `themes/pingfang-mono-plus-dark.json` | same (dark) |
| `install.cjs` | installs the themes, patches the app bundle, presets the font/theme settings |
| `backups/` | created by `install.cjs`; holds the original bundle(s) it patched |

## Requirements / 前置条件

- **OpenChamber 2** installed (scripts assume the Windows layout
  `%LOCALAPPDATA%\Programs\@openchamberelectron\resources`; override with the
  `OPENCHAMBER_RESOURCES` environment variable on other setups).
- These fonts installed locally — OpenChamber does **not** download them:
  - **PingFang SC (苹方-简)** — UI
  - **PingFang Mono SC** — code
  The font stacks fall back to `Microsoft YaHei` / `Consolas` if missing.
- Node.js available (`node --version`).

## Install / 安装

```bash
node install.cjs
```

Then **restart OpenChamber**.

What `install.cjs` does, and why each step is needed:

1. **Copies `themes/*.json`** into `%USERPROFILE%\.config\openchamber\themes\` — the folder
   OpenChamber 2 scans for custom themes.
2. **Patches `web-dist/assets/index-*.js`** (with a backup in `backups/`):
   - adds two font entries so *Settings → Appearance* offers **PingFang SC (苹方)** and
     **PingFang Mono SC**;
   - shrinks the desktop type scale so UI text sits one step below chat text:
     chat/markdown stays `0.875rem` (14px), UI header `0.8125rem` (13px),
     UI label/meta `0.75rem` (12px), micro `0.6875rem` (11px), settings page title `1rem` (16px).
3. **Presets the settings** (`uiFont`, `monoFont`, light/dark theme) in
   `%USERPROFILE%\.config\openchamber\settings.json` and `preferences.json`.

The script is idempotent — re-running it is safe and does nothing twice.

### Manual alternative

- Copy the two JSON files into `~/.config/openchamber/themes/`
  (%USERPROFILE%\.config\openchamber\themes\ on Windows), then
  **Settings → Appearance → Theme → Reload themes** and pick **Mono Plus PingFang**.
- The font/type part needs the patch; on macOS/Linux use `OPENCHAMBER_RESOURCES` pointing at
  OpenChamber's `resources` directory.

## After restarting / 重启后确认

| Item | Expected |
|------|----------|
| Interface Font | PingFang SC (苹方) |
| Code Font | PingFang Mono SC |
| Light / Dark theme | Mono Plus PingFang Light / Dark |
| UI text vs chat text | one step smaller (12px vs 14px at 100% interface size) |

If a setting did not stick (multiple OpenChamber clients write `preferences.json`, last write
wins), just pick it from the dropdown — the two font entries are available after the patch.

## After every OpenChamber update / 更新后

An update replaces `web-dist`, so the patch is lost. Re-run:

```bash
node install.cjs
```

and restart. Themes in `~/.config/openchamber/themes/` survive updates.

## How this was derived

- Theme colors are OpenChamber 2's built-in **Mono Plus** palette.
- Font entries were read from the running app; PingFang is used as a **local** font
  (no webfont download).
- The theme JSONs pass both of OpenChamber 2's validators: the Electron-main
  `normalizeThemeJson` required-color list and the renderer's zod rules
  (`config.fonts.*` must not contain `; { } < > \`).

## Credits

- Theme format: [OpenChamber custom themes](https://github.com/anomalyco/openchamber)
- Base colors: OpenChamber 2 built-in Mono Plus theme
