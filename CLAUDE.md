# RGB Range Quick Settings

GNOME Shell extension (Quick Settings toggle) that sets each monitor's RGB
quantization range through Mutter's `org.gnome.Mutter.DisplayConfig` D-Bus API
(`GetCurrentState` / `ApplyMonitorsConfig`, `rgb-range` property, mutter!4489).

## Layout

- `src/`: exactly what ships in the extensions.gnome.org (EGO) zip. Only
  `extension.js`, `metadata.json`, `stylesheet.css`. Never put repo tooling here.
- Repo root: README, LICENSE (GPL-2.0-or-later), ESLint config, CI, this file.

## Commands

```sh
npm install && npx eslint .                 # lint (must be clean)
gnome-extensions pack src --force           # build the EGO zip
gnome-extensions install --force *.shell-extension.zip
```

Test without touching the real session (nested/devkit window):
`dbus-run-session gnome-shell --devkit --wayland`
Logs: `journalctl -f -o cat /usr/bin/gnome-shell`

## Before submitting to EGO (TODO)

- [x] `uuid` is `rgb-range-quicksettings@yofuness.github.io`.
- [x] `url` added to metadata.json.
- [ ] Bump `shell-version` only to released versions (max one dev release).

## EGO review rules (gjs.guide/extensions/review-guidelines)

Lifecycle
- Nothing may be created, connected or modified at import time or in the
  `Extension` constructor. Only plain JS data (consts, Map, RegExp).
- `enable()` creates objects, connects signals, adds main-loop sources.
- `disable()` must undo all of it: destroy widgets, disconnect every signal
  (keep IDs or use `connectObject`/`disconnectObject`), remove every
  `GLib.timeout_add`/`idle_add` source, cancel pending async work. It must not be
  `async` (throws on GNOME 51+).
- No selective disabling, no `unlock-dialog` session mode unless justified.

Imports and APIs
- ESM only (`gi://`, `resource:///`). No `Gtk`, `Gdk`, `Adw` in extension.js.
  No `Clutter`, `Meta`, `St`, `Shell` in prefs.js.
- No deprecated modules: `ByteArray`, `Lang`, `Mainloop`.
- Avoid `run_dispose()`. Avoid spawning processes. No bundled binaries.
- Only use APIs that actually exist in the targeted Shell versions. Reviewers
  reject "imaginary" API usage. Check the source at gitlab.gnome.org/GNOME/gnome-shell.

Logging
- `console.log/warn/error`, never `log()`/`logError()`. Log errors only,
  no chatty debug output.

metadata.json
- Only needed keys: `uuid`, `name`, `description`, `shell-version`, `url`,
  optional `version-name`, `settings-schema`, `gettext-domain`. No `version`.
- Omit `session-modes` if only `user`.

GSettings (if ever added)
- id `org.gnome.shell.extensions.<name>`, path `/org/gnome/shell/extensions/<name>/`,
  file `schemas/<id>.gschema.xml` included in the zip.

AI-generated code policy
- Rejected for: unnecessary code, inconsistent style, imaginary APIs,
  comments that read like LLM prompts/explanations to the reader, dead code
  (`void x;`, unused params). Keep comments short and factual, explaining *why*,
  not narrating. The author must be able to explain every line.

Legal
- License compatible with GPL-2.0-or-later. Attribute copied code. No
  trademarked logos/names without permission.

## Code style (gjs.guide/guides/gjs/style-guide)

- 4-space indent, LF, final newline, single quotes, semicolons,
  trailing commas on multiline, `{a}` (no brace padding), `x => …` (no parens
  for single arg).
- `const` by default, `let` only when reassigned, never `var`. `===` always.
- Import groups separated by a blank line: `gi://`, then `resource:///`, then local.
- GObject subclasses: `GObject.registerClass(class Foo extends …)`, use
  `constructor()`/`super()`, not `_init`. Pass properties to the constructor
  in camelCase (`styleClass`, not `style_class`).
- Private members prefixed `_`, methods camelCase.
- Async Gio calls: `Gio._promisify(...)` once at module top, then `await`.
  Ignore `Gio.IOErrorEnum.CANCELLED` when cancelling in destroy.
- Styling goes in `stylesheet.css`, not inline `style =` strings.
