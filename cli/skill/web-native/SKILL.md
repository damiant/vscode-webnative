---
name: web-native
description: Run, build, sync, debug, and release web and mobile apps with the WebNative CLI (`npx wn`). Use for the day-to-day development loop on a project using Capacitor, Cordova, Ionic, Angular, React, Vue, Svelte, Next.js, Nuxt, Astro, or Vite — starting a dev server, running on an iOS or Android device, simulator, or emulator, live reload, building the web app, `cap sync`, debugging a WebView, running package.json scripts, and producing a signed ipa, apk, or aab.
---

# WebNative: run, build, and ship

`npx wn` performs the everyday development loop: serve, build, sync, run on a device, debug, and release. For other tasks see [Related skills](#related-skills).

## CLI contract

- **Always pass `--json`.** Stdout is one object: `{ ok, command, data, errors[], warnings[], durationMs }`. Branch on `errors[].code`, never on message text.
- **`--json` implies no prompting.** Missing required input exits `5` with the valid values in `errors[0].choices` and the flag to use in `errors[0].hint`. Choose one and re-run — never guess an id.
- **Run `wn info --json` first** in any session. It reports the framework, package manager, Capacitor platforms, scripts, and monorepo layout that every other command depends on.
- **In a monorepo pass `--project <name>`**, from `wn info`'s `monorepo.projects`.
- **`--dry-run`** prints the shell commands without running them. **`--yes`** accepts confirmations but never supplies a missing required value.
- Exit codes: `0` ok, `1` ran but failed, `2` usage error, `3` no project found, `4` missing prerequisite (Xcode, Android SDK, JDK, CocoaPods, adb, node_modules), `5` missing input, `6` blocking check findings, `7` timeout.

Full option lists and payload shapes: [docs.md](../../docs.md).

## Inspect

```bash
wn info --json            # framework, package manager, platforms, scripts, toolchain versions
wn devices list --json    # run targets with their ids
wn scripts list --json    # package.json scripts and NX targets
```

All read-only. `wn devices list --platform ios` narrows to one platform.

## Run

```bash
wn run web --port 4200 --background --json     # returns url, externalUrl, pid, logFile
wn run ios --device <id> --json
wn run android --device <id> --live-reload --json
wn stop --json                                 # stops everything wn started for this project
```

**Always use `--background` for `wn run web`.** In the foreground the command never returns. It prints a `pid` and a `logFile`; read the log file to check server output and call `wn stop` when finished.

`wn run ios` and `wn run android` need `--device <id>` from `wn devices list --json`. Omitting it when several targets exist exits `5` with the choices.

Useful flags: `--live-reload` (point the native app at the dev server), `--config <name>` (an `angular.json` configuration or a `.env.<name>` file), `--no-sync`, `--flavor <name>` for Android product flavors, `--prod`.

## Build and sync

```bash
wn build --prod --json
wn build ios --prod --json        # web build, then cap copy ios
wn sync --json                    # cap sync: copy web assets, update native deps
wn sync android --no-build --json
```

The build script resolves in this order: `wn:build`, `ionic:build`, `build`, then the framework default. Do not call `vite build` or `ng build` directly — `wn` picks the right one, applies the build configuration, and copies into the native projects.

On failure, `errors[]` contains parsed compiler errors with `file`, `line`, and `column` for TypeScript, ESLint, ESBuild, Vite, Next.js, Vue, Jest, Jasmine, Java, and Swift/Xcode. Add `--stream-json` to receive those as newline-delimited events while the build runs instead of only at the end.

## Debug

```bash
wn debug web --browser chrome --json
wn debug android --list --json          # debuggable WebViews on connected devices
wn debug android --webview <id> --json  # prints a cdpUrl to attach to
```

## Release

```bash
wn release ios --json
wn release android --type aab --json
```

Android signing comes from `WN_KEYSTORE_PATH`, `WN_KEYSTORE_PASSWORD`, `WN_KEYSTORE_ALIAS`, and `WN_KEYSTORE_ALIAS_PASSWORD`. Never write credentials into a committed file and never echo them. The success payload contains `artifactPath`.

---

## Workflows

### Run on a device

```
- [ ] wn info --json                          -> confirm the platform is installed
- [ ] wn devices list --platform ios --json
- [ ] wn run ios --device <id> --json
```

If the platform is not installed, add it first (`wn native add ios`, see `web-native-config`). On exit `4`, report the missing tool — do not attempt to install Xcode or Android Studio.

### Fix a failing build

```
- [ ] wn build --json
- [ ] Read errors[] for file/line/column
- [ ] Edit the source
- [ ] wn build --json until it passes
```

### Ship a release build

```
- [ ] wn check --error-on error --json    -> stop and report if it exits 6
- [ ] wn native set version <v> --json    -> see web-native-config
- [ ] wn native set build <n> --json
- [ ] wn sync --json
- [ ] wn release ios --json  /  wn release android --type aab --json
```

## Handling exit code 5

The most common non-fatal outcome. Read `errors[0]`:

```json
{
  "code": "MISSING_INPUT",
  "input": "device",
  "choices": [
    { "id": "1B2C3D4E-...", "name": "iPhone 16 Pro", "type": "simulator" },
    { "id": "00008120-...", "name": "Damian's iPhone", "type": "device" }
  ],
  "hint": "Re-run with --device <id>"
}
```

Pick from `choices` and re-run with the flag from `hint`. When the choice is consequential — which physical device, which build configuration — ask the user rather than deciding for them.

## What not to do

- Do not run `wn run web` in the foreground.
- Do not invent a device id. Run `wn devices list --json` first.
- Do not fall back to raw `cap`, `ng`, `vite`, or `npm run` commands when a `wn` command exists; `wn` resolves the project's script names, port, package manager, and platform, which a raw command will get wrong.
- Do not leave background dev servers running after a task; call `wn stop`.

## Related skills

- **`web-native-config`** — bundle id, app name, version and build number, icons and splash screens, new projects, Angular generation, CLI settings.
- **`web-native-packages`** — outdated packages, upgrades, security audit, peer dependencies, Capacitor plugin search and install.
- **`web-native-migrate`** — project health checks and guided Capacitor, Angular, and Cordova migrations.
