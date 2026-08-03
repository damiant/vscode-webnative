# WebNative CLI (`wn`)

> Status: **design document**. Nothing in this file is implemented yet. It is the specification for a CLI that exposes the features of the [WebNative VS Code extension](https://webnative.dev) to terminals, CI pipelines, and coding agents.

## Contents

- [Overview](#overview)
- [Installation and invocation](#installation-and-invocation)
- [Design principles](#design-principles)
- [Global options](#global-options)
- [Output modes](#output-modes)
- [Exit codes](#exit-codes)
- [Project detection](#project-detection)
- [Monorepos](#monorepos)
- [Command reference](#command-reference)
  - [`wn info`](#wn-info)
  - [`wn new`](#wn-new)
  - [`wn run`](#wn-run)
  - [`wn build`](#wn-build)
  - [`wn sync`](#wn-sync)
  - [`wn open`](#wn-open)
  - [`wn stop`](#wn-stop)
  - [`wn devices`](#wn-devices)
  - [`wn debug`](#wn-debug)
  - [`wn scripts`](#wn-scripts)
  - [`wn check`](#wn-check)
  - [`wn packages`](#wn-packages)
  - [`wn plugins`](#wn-plugins)
  - [`wn native`](#wn-native)
  - [`wn assets`](#wn-assets)
  - [`wn release`](#wn-release)
  - [`wn migrate`](#wn-migrate)
  - [`wn integrate`](#wn-integrate)
  - [`wn generate`](#wn-generate)
  - [`wn config`](#wn-config)
- [Configuration](#configuration)
- [Environment variables](#environment-variables)
- [Prompting and non-interactive use](#prompting-and-non-interactive-use)
- [Feature mapping from the extension](#feature-mapping-from-the-extension)
- [Out of scope](#out-of-scope)

---

## Overview

`wn` is a single command-line entry point for web and mobile app development tasks: serving and building a web app, running it on iOS and Android devices, keeping Capacitor projects in sync, editing native project settings, generating splash screens and icons, auditing and upgrading dependencies, and running the recommendation engine that the extension shows in its sidebar.

The CLI targets three audiences, in this order of priority:

1. **Coding agents** — every command has a machine-readable `--json` mode, a stable exit-code contract, and a fully non-interactive path. See the [agent skills](./skill/README.md).
2. **CI pipelines** — no TTY assumptions, no hidden state, no prompts unless asked for.
3. **Humans at a terminal** — readable output, interactive pickers when a required value is missing.

It works with Angular, React, Vue, Svelte, Solid, Preact, Lit, Qwik, Astro, Next.js, Nuxt, Vite, Ionic, Capacitor, and Cordova projects, and with NX, npm/yarn/bun workspaces, pnpm workspaces, Lerna, and folder-based monorepos.

## Installation and invocation

```bash
# One-off, always latest
npx wn <command> [options]

# Project-local (recommended for CI so the version is pinned)
npm install --save-dev wn
npx wn <command>

# Global
npm install -g wn
wn <command>
```

The binary is `wn`. The package is published as `wn`, with `webnative` as an alias package that depends on it.

`wn` with no arguments prints a short summary of the detected project plus the most relevant next commands. `wn --help` prints the full command list; `wn <command> --help` prints options for one command.

## Design principles

**Deterministic.** The same command with the same flags in the same project produces the same underlying shell command. `--dry-run` prints that command without running it, so a caller can inspect or log it.

**No hidden interactivity.** A command either has everything it needs from flags, config, and project state, or it fails with exit code `5` and a JSON payload describing exactly which input is missing and what the valid choices are. Interactive prompts only happen when stdin is a TTY and `--no-input` was not passed.

**Read-only by default where it matters.** Commands that inspect (`info`, `check`, `devices`, `packages list`, `plugins search`, `native get`) never modify the project. Commands that write say so in their help text and support `--dry-run`.

**Composable.** Every list-producing command supports `--json`, so results can be piped into `jq` or parsed by an agent, then fed back as arguments to a follow-up command.

**Same engine as the extension.** The CLI and the extension share the project analyzer, the recommendation rules, and the command builders. A recommendation id shown in the extension sidebar is the same id accepted by `wn check --fix <id>`.

## Global options

Available on every command.

| Option                   | Default           | Description                                                                                           |
| ------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `--cwd <path>`           | current directory | Directory to treat as the workspace root.                                                             |
| `--project <name>`       | auto              | Sub-project to act on in a monorepo. See [Monorepos](#monorepos).                                     |
| `--json`                 | off               | Emit a single JSON object on stdout, nothing else. Implies `--no-input` and `--no-color`.             |
| `--yes`, `-y`            | off               | Accept the default answer for every confirmation. Does not invent values for missing required inputs. |
| `--no-input`             | off when TTY      | Never prompt. Missing required input becomes exit code `5`.                                           |
| `--dry-run`              | off               | Print the shell command(s) that would run, then exit `0`. Makes no changes.                           |
| `--verbose`, `-v`        | off               | Include the underlying shell commands and their raw output.                                           |
| `--quiet`, `-q`          | off               | Suppress progress output; only print errors and final results.                                        |
| `--no-color`             | auto              | Disable ANSI color. Also honours `NO_COLOR`.                                                          |
| `--package-manager <pm>` | detected          | `npm`, `pnpm`, `yarn`, or `bun`. Overrides lockfile detection.                                        |
| `--timeout <seconds>`    | none              | Abort the command after this many seconds with exit code `7`.                                         |
| `--version`              | —                 | Print the CLI version.                                                                                |
| `--help`, `-h`           | —                 | Print help for the CLI or the current command.                                                        |

## Output modes

### Human output

Progress lines to stderr, results to stdout. Errors are prefixed and colorized; recommendations are grouped the way the extension groups them in the sidebar.

### JSON output

With `--json`, stdout contains exactly one JSON object and nothing else. Progress and log lines move to stderr. The envelope is stable across all commands:

```json
{
  "ok": true,
  "command": "devices list",
  "data": {},
  "warnings": [],
  "errors": [],
  "durationMs": 1840
}
```

On failure:

```json
{
  "ok": false,
  "command": "run ios",
  "data": null,
  "warnings": [],
  "errors": [
    {
      "code": "MISSING_INPUT",
      "message": "No device selected and more than one device is available.",
      "input": "device",
      "choices": [
        { "id": "1B2C3D4E-...", "name": "iPhone 16 Pro", "type": "simulator" },
        { "id": "00008120-...", "name": "Damian's iPhone", "type": "device" }
      ],
      "hint": "Re-run with --device <id>"
    }
  ],
  "durationMs": 320
}
```

`errors[].code` values are stable identifiers, listed per command. Agents should branch on `code`, never on `message`.

### Streaming output

Long-running commands (`run`, `build`, `sync`, `migrate`) stream the child process output to stderr as it happens. With `--json`, the final object is still the only thing on stdout; add `--stream-json` to also receive newline-delimited progress events on stdout before the final object:

```
{"event":"start","step":"build","command":"npm run build"}
{"event":"log","level":"info","message":"vite v5.4.0 building for production..."}
{"event":"error","file":"src/app.ts","line":42,"column":9,"message":"Type 'string' is not assignable to type 'number'."}
{"event":"end","step":"build","exitCode":0}
{"ok":true,"command":"build","data":{...}}
```

The `error` event uses the extension's build-output parsers, so ESLint, ESBuild, Vite, Next.js, TypeScript, Vue, Jest, Jasmine, Java, and Swift/Xcode errors all arrive as structured `file`/`line`/`column` records regardless of the toolchain that produced them.

## Exit codes

| Code  | Meaning                                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| `0`   | Success.                                                                                                         |
| `1`   | The command ran but failed (build error, test failure, device launch failure).                                   |
| `2`   | Usage error: unknown command, bad flag, invalid argument value.                                                  |
| `3`   | No supported project found at `--cwd`.                                                                           |
| `4`   | A prerequisite is missing (Xcode, Android SDK, JDK, CocoaPods, adb, `node_modules`). The error payload names it. |
| `5`   | Required input is missing and prompting is not possible. `errors[0].choices` lists the valid values.             |
| `6`   | Checks found blocking issues (`wn check --error-on <severity>`).                                                 |
| `7`   | Timed out.                                                                                                       |
| `130` | Interrupted (SIGINT).                                                                                            |

## Project detection

`wn` inspects the workspace the same way the extension does, before running any command:

- **Project type** — `Capacitor` when `@capacitor/core`, `@capacitor/ios`, or `@capacitor/android` is in `dependencies`; `Cordova` when `cordova-ios`/`cordova-android` is present or `package.json` has a `cordova` key; otherwise `Other`.
- **Framework** — from `ionic.config.json` `type` if present, otherwise inferred from `package.json`: `@vue/cli-service` → `vue`, `@angular/core` → `angular`, `@angular/cli` or `@ionic/angular` → `angular-standalone`, `react-scripts` → `react`, `vite` + `react` → `react-vite`, `vite` + `vue` → `vue-vite`.
- **Native platforms** — a platform counts as present when both the `@capacitor/<platform>` dependency and the `ios`/`android` folder exist.
- **Package manager** — from the lockfile (`yarn.lock`, `pnpm-lock.yaml`, `bun.lock*`, else npm), overridden by the `packageManager` field, the monorepo type, or `--package-manager`.
- **Monorepo** — NX (`nx.json`), npm/yarn/bun `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, or sibling folders that each contain a web `package.json`.

Run `wn info --json` to see everything that detection produced.

## Monorepos

When a monorepo is detected and it contains more than one runnable project, commands that act on a project require `--project <name>`:

```bash
wn info --json                  # lists projects[] with name, path, framework
wn run web --project storefront
wn build --project admin --prod
```

Without `--project`, `wn` uses the single project if there is only one, the project containing `--cwd` if `--cwd` points inside one, or the `defaultProject` from `ionic.config.json`. If none of those resolve, it exits `5` with the list of project names in `choices`.

`--project` is ignored for workspace-wide commands (`wn packages audit`, `wn config`).

---

# Command reference

## `wn info`

Inspect the project and print everything detection found. Read-only. This is the command an agent should run first.

```bash
wn info [--json] [--check]
```

| Option        | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `--check`     | Also run the recommendation engine and include a `checks` summary. Slower. |
| `--platforms` | Only report native platform state.                                         |

```bash
$ wn info --json
```

```json
{
  "ok": true,
  "command": "info",
  "data": {
    "root": "/Users/me/apps/storefront",
    "name": "storefront",
    "type": "Capacitor",
    "framework": "angular-standalone",
    "packageManager": "pnpm",
    "monorepo": { "type": "nx", "projects": ["storefront", "admin"], "selected": "storefront" },
    "webDir": "dist/storefront/browser",
    "devServer": { "script": "start", "defaultPort": 8100 },
    "buildScript": "build",
    "capacitor": {
      "cliVersion": "7.2.0",
      "coreVersion": "7.2.0",
      "configFile": "capacitor.config.ts",
      "appId": "com.example.storefront",
      "appName": "Storefront",
      "platforms": [
        { "name": "ios", "installed": true, "version": "17.2", "buildNumber": "42" },
        { "name": "android", "installed": true, "version": "17.2", "buildNumber": "42" }
      ]
    },
    "plugins": [{ "name": "@capacitor/camera", "version": "7.0.1" }],
    "scripts": ["start", "build", "test", "lint"],
    "toolchain": {
      "node": "22.11.0",
      "xcode": "16.2",
      "androidStudio": "2024.2",
      "jdk": "21.0.4",
      "cocoapods": "1.16.2",
      "adb": "/Users/me/Library/Android/sdk/platform-tools/adb"
    }
  }
}
```

Error codes: `NO_PROJECT` (exit `3`).

## `wn new`

Create a new project from a starter template. Equivalent to the extension's New Project wizard.

```bash
wn new [name] [options]
```

| Option                   | Description                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `--template <id>`        | Template id, e.g. `ionic-angular-tabs`, `vite-react`, `nextjs`, `nuxt`, `astro`, `capacitor-plugin`.                           |
| `--framework <id>`       | Filter templates by framework: `angular`, `react`, `vue`, `svelte`, `solid`, `lit`, `preact`, `qwik`, `astro`, `next`, `nuxt`. |
| `--targets <list>`       | Comma-separated: `web`, `ios`, `android`. Adds and configures Capacitor platforms.                                             |
| `--dir <path>`           | Parent folder for the new project. Defaults to `--cwd`.                                                                        |
| `--package-manager <pm>` | Package manager for the new project.                                                                                           |
| `--no-install`           | Scaffold without installing dependencies.                                                                                      |
| `--no-git`               | Skip `git init`.                                                                                                               |
| `--list-templates`       | Print the template catalog and exit. Read-only.                                                                                |

```bash
wn new --list-templates --json
wn new storefront --template ionic-angular-tabs --targets web,ios,android --package-manager pnpm -y
```

Error codes: `UNKNOWN_TEMPLATE`, `DIR_NOT_EMPTY`, `MISSING_INPUT` (no template chosen).

## `wn run`

Serve the web app or launch it on a device or emulator.

```bash
wn run web [options]
wn run ios [options]
wn run android [options]
```

The web command resolves the serve script in this order: `wn:serve`, `ionic:serve`, `serve`, `dev`, `start`, then the framework default (`ng serve`, `vite`, `react-scripts start`, `vue-cli-service serve`, `nx serve <project>`).

### Shared options

| Option                 | Default     | Description                                                                                     |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `--port <n>`           | `8100`      | Dev server port. If busy, the next free port is used unless `--strict-port`.                    |
| `--strict-port`        | off         | Fail instead of incrementing the port.                                                          |
| `--config <name>`      | none        | Run configuration: an `angular.json` configuration, or a `.env.<name>` file for Vite/React/Vue. |
| `--prod`               | off         | Production mode.                                                                                |
| `--background`         | off         | Start and return immediately, printing the pid and URL. Use `wn stop` to end it.                |
| `--open` / `--no-open` | `--no-open` | Open a browser once the server is ready.                                                        |

### `wn run web` options

| Option                 | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| `--host <ip>`          | Bind address. `--host external` picks the machine's external IPv4 address.    |
| `--https`              | Serve over HTTPS using a locally generated certificate (see `wn config ssl`). |
| `--public-host <host>` | Host name to advertise to devices, used by live reload.                       |

### `wn run ios` / `wn run android` options

| Option                 | Description                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `--device <id>`        | Target device or simulator/emulator id from `wn devices list`.                                      |
| `--device-name <name>` | Match by display name instead of id. Fails if ambiguous.                                            |
| `--live-reload`        | Point the native app at the dev server instead of the bundled web assets. Implies an external host. |
| `--external`           | Use the external IP for live reload even when a public host is configured.                          |
| `--no-sync`            | Skip `cap sync` before launching.                                                                   |
| `--no-build`           | Skip the web build even if the project changed since the last run.                                  |
| `--flavor <name>`      | Android product flavor, read from `android/app/build.gradle`.                                       |
| `--scheme <name>`      | iOS scheme.                                                                                         |
| `--ssl`                | Serve the live-reload dev server over HTTPS.                                                        |

```bash
# Serve on a fixed port, non-interactive, in the background
wn run web --port 4200 --background --json

# Run on a specific simulator with live reload
wn devices list --platform ios --json
wn run ios --device 1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D --live-reload

# CI: build and launch on the only connected Android device
wn run android --no-sync --config staging -y
```

Success payload:

```json
{
  "ok": true,
  "command": "run web",
  "data": {
    "url": "http://localhost:4200",
    "externalUrl": "http://192.168.1.42:4200",
    "pid": 48213,
    "background": true,
    "logFile": "/tmp/wn/storefront-web.log"
  }
}
```

Error codes: `MISSING_INPUT` (device required, `choices` populated), `NO_DEVICES`, `PLATFORM_NOT_ADDED`, `MISSING_TOOL` (Xcode, Android SDK), `BUILD_FAILED`, `LAUNCH_FAILED`, `PORT_IN_USE`.

## `wn build`

Build the web app, and optionally copy the result into the native projects.

```bash
wn build [platform] [options]
```

`platform` is `web` (default), `ios`, `android`, or `all`. Naming a native platform runs the web build then `cap copy <platform>`.

| Option            | Description                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| `--prod`          | Production build. Equivalent to the `buildForProduction` extension setting.   |
| `--config <name>` | Build configuration from `angular.json`, or `--mode` for Vite-based projects. |
| `--sourcemap`     | Force source maps on.                                                         |
| `--no-copy`       | Build only; do not `cap copy`.                                                |
| `--clean`         | Remove the output directory first.                                            |

Build script resolution: `wn:build`, `ionic:build`, `build`, then the framework default (`ng build`, `vite build`, `react-scripts build`, `vue-cli-service build`, `nx build <project>`).

```bash
wn build --prod --config production --json
wn build ios --prod
```

Success payload includes `outputDir`, `durationMs`, `sizeBytes`, and `warnings[]`. On failure, `errors[]` contains parsed compiler errors with `file`, `line`, `column`.

Error codes: `BUILD_FAILED`, `NO_BUILD_SCRIPT`, `UNKNOWN_CONFIG`.

## `wn sync`

Run `cap sync` — copy web assets and update native dependencies.

```bash
wn sync [ios|android] [--no-build] [--deployment]
```

| Option         | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| `--no-build`   | Sync the existing web output without rebuilding.                              |
| `--deployment` | Pass `--deployment` to CocoaPods (fails if `Podfile.lock` would change).      |
| `--inline`     | Inline the sync output rather than using a spinner. Default in `--json` mode. |

Error codes: `SYNC_FAILED`, `PLATFORM_NOT_ADDED`, `MISSING_TOOL` (CocoaPods).

## `wn open`

Open the project in an external tool.

```bash
wn open xcode
wn open android-studio
wn open browser [--url <url>]
wn open folder <ios|android|www>
```

Error codes: `MISSING_TOOL`, `PLATFORM_NOT_ADDED`.

## `wn stop`

Stop dev servers and native launches started by `wn run --background`.

```bash
wn stop [--all] [--pid <n>] [--port <n>]
```

With no arguments, stops everything `wn` started for the current project. `wn stop --all` stops every `wn`-managed process on the machine.

## `wn devices`

List and inspect run targets. Read-only.

```bash
wn devices list [--platform ios|android] [--json]
wn devices default [--platform <p>] [--set <id>] [--clear]
```

```json
{
  "ok": true,
  "command": "devices list",
  "data": {
    "ios": [
      { "id": "00008120-000A1B2C3D4E002E", "name": "Damian's iPhone", "type": "device", "os": "18.3" },
      { "id": "1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D", "name": "iPhone 16 Pro", "type": "simulator", "os": "18.2" }
    ],
    "android": [{ "id": "Pixel_8_API_35", "name": "Pixel 8 API 35", "type": "emulator", "api": 35, "os": "15" }]
  }
}
```

`wn devices default --set <id>` remembers a target for later `wn run` calls, mirroring the extension's device memory.

Error codes: `MISSING_TOOL` (adb, xcrun), `NO_DEVICES`.

## `wn debug`

Attach a debugger.

```bash
wn debug web [--browser chrome|edge] [--port <n>]
wn debug android [--list] [--device <id>] [--webview <id>] [--web-root workspace|www]
```

`wn debug android --list` enumerates debuggable WebViews on connected devices and is read-only. Without `--webview`, a single WebView is attached automatically; more than one produces exit `5` with the list in `choices`.

The command prints a Chrome DevTools Protocol endpoint so external debuggers can attach:

```json
{ "ok": true, "command": "debug android", "data": { "cdpUrl": "ws://localhost:9222/devtools/page/A1B2", "port": 9222 } }
```

Error codes: `MISSING_TOOL` (adb), `NO_WEBVIEWS`, `MISSING_INPUT`.

## `wn scripts`

Work with `package.json` scripts, including NX targets.

```bash
wn scripts list [--json]
wn scripts run <name> [-- <args...>]
```

```bash
wn scripts list --json
wn scripts run test -- --coverage
```

Error codes: `UNKNOWN_SCRIPT`, `SCRIPT_FAILED`.

## `wn check`

Run the recommendation engine — the same rules that populate the extension's Recommendations section. Read-only unless `--fix` is used.

```bash
wn check [options]
```

| Option                  | Description                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--json`                | Machine-readable findings.                                                                                                    |
| `--severity <list>`     | Filter: `error`, `warning`, `info`. Default all.                                                                              |
| `--category <list>`     | Filter: `packages`, `capacitor`, `cordova`, `angular`, `typescript`, `android`, `ios`, `browserslist`, `security`, `privacy`. |
| `--error-on <severity>` | Exit `6` if any finding at or above this severity exists. Use in CI.                                                          |
| `--fix <id>`            | Apply the fix for one finding. Modifies the project.                                                                          |
| `--fix-all [severity]`  | Apply every automatic fix at or above a severity. Modifies the project.                                                       |
| `--ignore <id>`         | Add a finding to the project ignore list.                                                                                     |
| `--show-ignored`        | Include ignored findings in the output.                                                                                       |

```json
{
  "ok": true,
  "command": "check",
  "data": {
    "findings": [
      {
        "id": "capacitor-version-mismatch",
        "severity": "error",
        "category": "capacitor",
        "title": "@capacitor/android is 6.2.0 but @capacitor/core is 7.2.0",
        "detail": "All @capacitor/* packages must share a major version.",
        "fixable": true,
        "fix": { "id": "capacitor-version-mismatch", "command": "pnpm add @capacitor/android@7.2.0" }
      },
      {
        "id": "deprecated-plugin-cordova-plugin-camera",
        "severity": "warning",
        "category": "packages",
        "title": "cordova-plugin-camera is deprecated",
        "detail": "Replace with @capacitor/camera.",
        "fixable": true
      }
    ],
    "counts": { "error": 1, "warning": 1, "info": 4, "ignored": 2 }
  }
}
```

Findings cover: Capacitor version consistency and plugin compatibility, deprecated and end-of-life packages, Cordova plugin issues, `config.xml` and `AndroidManifest.xml` settings, `angular.json` issues, deprecated TypeScript compiler options, browserslist, missing Capacitor platforms, missing privacy manifest entries, and Android `minifyEnabled`.

```bash
# CI gate
wn check --error-on error --json

# Fix one thing an agent decided to fix
wn check --fix capacitor-version-mismatch
```

Error codes: `UNKNOWN_FINDING`, `FIX_FAILED`, `NOT_FIXABLE`.

## `wn packages`

Dependency management across npm, pnpm, yarn, and bun.

```bash
wn packages list [--outdated] [--plugins] [--json]
wn packages add <name...> [--dev] [--version <v>] [--no-sync]
wn packages remove <name...> [--no-sync]
wn packages upgrade [name] [--version <v>] [--latest] [--all]
wn packages minor [--apply]
wn packages audit [--fix] [--severity <level>]
wn packages peers [--fix]
wn packages install [--force] [--frozen-lockfile]
wn packages size [--json]
wn packages export [--out <file>]
```

| Subcommand       | Description                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `list`           | Installed packages with `current`, `wanted`, `latest`, and `deprecated`. `--plugins` restricts to Capacitor/Cordova plugins.  |
| `add` / `remove` | Install or uninstall. In a Capacitor project a `cap sync` runs afterwards unless `--no-sync`.                                 |
| `upgrade`        | Upgrade one package (`--version` for an exact version, `--latest` for the newest release) or `--all` for everything outdated. |
| `minor`          | Report dependencies with a minor/patch update available; `--apply` installs them in one step.                                 |
| `audit`          | `npm audit` filtered to direct dependencies, with severity counts; `--fix` runs the fix.                                      |
| `peers`          | Report unmet peer dependencies and propose compatible versions.                                                               |
| `install`        | Install all dependencies.                                                                                                     |
| `size`           | Production build plus bundle analysis: per-module and per-asset sizes.                                                        |
| `export`         | Write `project-summary.md`: every dependency with its version, last release date, and a maintenance rating.                   |

```bash
wn packages list --outdated --json
wn packages upgrade @capacitor/core --version 7.2.0
wn packages minor --apply -y
wn packages audit --severity high --json
```

```json
{
  "ok": true,
  "command": "packages list",
  "data": {
    "packages": [
      { "name": "@angular/core", "current": "19.2.1", "wanted": "19.2.9", "latest": "20.1.0", "type": "dependency" },
      { "name": "moment", "current": "2.30.1", "latest": "2.30.1", "deprecated": true, "type": "dependency" }
    ],
    "plugins": [{ "name": "@capacitor/camera", "current": "7.0.1", "latest": "7.0.2", "ios": true, "android": true }]
  }
}
```

Error codes: `UNKNOWN_PACKAGE`, `INSTALL_FAILED`, `AUDIT_FAILED`, `INCOMPATIBLE_VERSION`.

## `wn plugins`

Browse and install Capacitor and Cordova plugins from the plugin directory. `search` and `info` are read-only.

```bash
wn plugins search <term> [--platform ios|android] [--official] [--json]
wn plugins info <name> [--json]
wn plugins add <name> [--version <v>]
wn plugins remove <name>
wn plugins permissions [--json]
```

`wn plugins info` returns the npm metadata, repository stats, latest version, supported platforms, and the version that is compatible with the project's Capacitor major version. `wn plugins add` resolves that compatible version automatically unless `--version` is given, then runs `cap sync`.

`wn plugins permissions` lists the Android permissions and features each installed plugin contributes, parsed from its `plugin.xml`.

Error codes: `UNKNOWN_PLUGIN`, `NO_COMPATIBLE_VERSION`, `INSTALL_FAILED`.

## `wn native`

Read and write native project settings. `get` is read-only.

```bash
wn native get [--platform ios|android] [--json]
wn native set <property> <value> [--platform ios|android]
wn native add <ios|android>
wn native privacy check [--json]
wn native privacy add [--reason <code>...]
```

Properties: `app-id` (bundle identifier), `app-name` (display name), `version`, `build` (build number).

Without `--platform`, `set` writes both platforms and the Capacitor config. With `--platform`, it writes only that platform, which is how the extension supports iOS and Android diverging.

```bash
wn native get --json
wn native set app-id com.example.storefront
wn native set build 128 --platform ios
wn native set version 2.4.0
wn native add android
```

`wn native privacy check` reports whether `PrivacyInfo.xcprivacy` exists and which Apple required-reason API categories the installed plugins need. `wn native privacy add` creates the file, registers it in the Xcode project, and adds the reason codes.

```json
{
  "ok": true,
  "command": "native get",
  "data": {
    "ios": { "appId": "com.example.storefront", "appName": "Storefront", "version": "2.4.0", "build": "128" },
    "android": { "appId": "com.example.storefront", "appName": "Storefront", "version": "2.4.0", "build": "128" }
  }
}
```

Error codes: `PLATFORM_NOT_ADDED`, `INVALID_VALUE` (bundle id / version format), `WRITE_FAILED`.

## `wn assets`

Generate splash screens and app icons from source images in `resources/`.

```bash
wn assets generate [--ios] [--android] [--pwa]
wn assets set <type> <file>
wn assets list [--json]
```

`type` is `splash`, `splash-dark`, `icon`, `icon-foreground`, or `icon-background`. `wn assets set` copies the file into `resources/` with the expected name; `generate` runs `@capacitor/assets` for the requested targets (all installed platforms when no target flag is given) and adds the generated output to `.gitignore`.

```bash
wn assets set icon ./design/icon-1024.png
wn assets generate --ios --android
```

Error codes: `MISSING_SOURCE_ASSET`, `INVALID_IMAGE` (wrong dimensions), `GENERATE_FAILED`.

## `wn release`

Produce a signed, distributable native build.

```bash
wn release ios [--type ipa] [--config <name>]
wn release android --type apk|aab [--keystore <path>] [--keystore-password <p>] [--keystore-alias <a>] [--keystore-alias-password <p>] [--save-config]
```

Android signing values may also come from `capacitor.config.*` (written by `--save-config`) or from environment variables (`WN_KEYSTORE_PATH`, `WN_KEYSTORE_PASSWORD`, `WN_KEYSTORE_ALIAS`, `WN_KEYSTORE_ALIAS_PASSWORD`), which is the recommended approach in CI. Passwords are never written to disk or echoed in `--dry-run` output.

The success payload contains `artifactPath`.

Error codes: `MISSING_INPUT` (signing values), `MISSING_TOOL`, `SIGNING_FAILED`, `BUILD_FAILED`.

## `wn migrate`

Run guided migrations.

```bash
wn migrate list [--json]
wn migrate capacitor [--to <major>]
wn migrate angular [--to <major>] [--all]
wn migrate cordova [--remove]
wn migrate spm
wn migrate package-manager <pnpm|bun|npm|yarn>
```

| Subcommand        | Description                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `list`            | Which migrations apply to this project, with the current and target versions. Read-only.                                                  |
| `capacitor`       | Migrate to the next Capacitor major (or `--to`), including native file changes and minimum plugin versions.                               |
| `angular`         | Migrate Angular one major at a time. `--all` repeats until the latest supported major. Refuses to run on a dirty git tree unless `--yes`. |
| `cordova`         | Migrate a Cordova project to Capacitor; `--remove` strips the Cordova project afterwards.                                                 |
| `spm`             | Run the iOS CocoaPods to Swift Package Manager migration assistant.                                                                       |
| `package-manager` | Convert the project to another package manager.                                                                                           |

Every migration supports `--dry-run`, which reports the steps and file changes without applying them.

```bash
wn migrate list --json
wn migrate capacitor --to 8 --dry-run
wn migrate angular --to 20 -y
```

Error codes: `DIRTY_GIT`, `PRECONDITION_FAILED` (JDK, Android Studio, or plugin versions too old), `MIGRATION_FAILED`, `NOT_APPLICABLE`.

## `wn integrate`

Add a capability to an existing project.

```bash
wn integrate capacitor [--app-id <id>] [--app-name <name>] [--web-dir <dir>] [--platforms ios,android]
wn integrate pwa
wn integrate prettier [--husky]
```

`wn integrate capacitor` infers `webDir` from `angular.json` `outputPath` or the conventional `www`/`dist`/`build` folder when `--web-dir` is omitted.

Error codes: `ALREADY_INTEGRATED`, `MISSING_INPUT`, `INTEGRATE_FAILED`.

## `wn generate`

Framework code generation. Currently Angular, delegating to `ng generate` with the project's package manager.

```bash
wn generate <schematic> <name> [-- <ng args...>]
wn generate --list [--json]
```

Schematics include `component`, `service`, `module`, `class`, `directive`, `pipe`, `guard`, `interceptor`, and `page` when `@ionic/angular-toolkit` is installed.

```bash
wn generate component checkout/payment-form
wn generate service data -- --skip-tests
```

Also runs the codemod-style schematics the extension exposes:

```bash
wn generate migration --list --json
wn generate migration control-flow
wn generate migration inject
wn generate migration signal-inputs
wn generate migration standalone-ionic
wn generate migration karma-to-vitest
wn generate migration application-builder
```

Error codes: `UNKNOWN_SCHEMATIC`, `NOT_ANGULAR`, `GENERATE_FAILED`.

## `wn config`

Read and write CLI settings. Read-only for `list` and `get`.

```bash
wn config list [--json]
wn config get <key>
wn config set <key> <value> [--global]
wn config unset <key> [--global]
wn config ssl create
```

| Key                   | Type    | Default         | Description                                  |
| --------------------- | ------- | --------------- | -------------------------------------------- |
| `defaultPort`         | number  | `8100`          | Base dev server port.                        |
| `buildForProduction`  | boolean | `false`         | Default `--prod` for builds.                 |
| `packageManager`      | enum    | detected        | `npm`, `pnpm`, `yarn`, `bun`.                |
| `javaHome`            | path    | `$JAVA_HOME`    | JDK for Android builds.                      |
| `androidSdk`          | path    | `$ANDROID_HOME` | Android SDK location.                        |
| `adbPath`             | path    | on `PATH`       | adb binary.                                  |
| `shellPath`           | path    | auto            | Shell used to run commands.                  |
| `internalAddress`     | boolean | `false`         | Prefer the internal address for live reload. |
| `debugBrowser`        | enum    | `chrome`        | `chrome` or `edge`.                          |
| `androidDebugWebRoot` | enum    | `www`           | `workspace` or `www`.                        |
| `telemetry`           | boolean | `true`          | Anonymous usage reporting.                   |

Project settings live in `wn.json` at the project root; `--global` writes to `~/.config/wn/config.json`. Project values win, and command-line flags win over both.

`wn config ssl create` generates the local certificate authority and server certificate used by `wn run web --https` and `wn run <platform> --live-reload --ssl`, and prints the path to the CA certificate that devices need to trust.

---

## Configuration

Precedence, highest first:

1. Command-line flags
2. Environment variables
3. `wn.json` in the project root (or the sub-project root in a monorepo)
4. `~/.config/wn/config.json`
5. Built-in defaults

```json
{
  "$schema": "https://webnative.dev/schema/wn.json",
  "defaultPort": 4200,
  "packageManager": "pnpm",
  "buildForProduction": false,
  "run": {
    "ios": { "device": "iPhone 16 Pro" },
    "android": { "flavor": "staging" }
  },
  "check": {
    "ignore": ["deprecated-plugin-cordova-plugin-camera"],
    "errorOn": "error"
  }
}
```

`wn.json` is safe to commit. Nothing secret belongs in it; signing credentials come from environment variables or flags.

## Environment variables

| Variable                                                                                      | Description                                           |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `WN_JSON`                                                                                     | Set to `1` to default every command to `--json`.      |
| `WN_NO_INPUT`                                                                                 | Set to `1` to default every command to `--no-input`.  |
| `WN_PACKAGE_MANAGER`                                                                          | Default package manager.                              |
| `WN_PROJECT`                                                                                  | Default `--project` for monorepos.                    |
| `WN_TELEMETRY`                                                                                | `0` disables anonymous usage reporting.               |
| `WN_KEYSTORE_PATH`, `WN_KEYSTORE_PASSWORD`, `WN_KEYSTORE_ALIAS`, `WN_KEYSTORE_ALIAS_PASSWORD` | Android signing credentials for `wn release android`. |
| `JAVA_HOME`, `ANDROID_HOME`                                                                   | Used when the matching config keys are unset.         |
| `NO_COLOR`                                                                                    | Disables color.                                       |

## Prompting and non-interactive use

A command prompts only when all of these hold: stdin is a TTY, `--no-input` was not passed, `--json` was not passed, and a required value is genuinely missing.

Otherwise the command exits `5` and the JSON payload names the missing input and enumerates the valid choices, so a caller can pick one and re-run:

```bash
$ wn run ios --json
{"ok":false,"command":"run ios","errors":[{"code":"MISSING_INPUT","input":"device","choices":[...],"hint":"Re-run with --device <id>"}]}
```

`--yes` answers confirmations ("install these packages?", "overwrite this file?") with the default. It never fabricates a value for a missing required input — an agent still has to choose the device, the version, or the template explicitly.

## Feature mapping from the extension

| Extension feature                    | CLI equivalent                                                   |
| ------------------------------------ | ---------------------------------------------------------------- |
| Sidebar → Run → Web / Android / iOS  | `wn run web` / `wn run android` / `wn run ios`                   |
| Live Reload toggle                   | `wn run <platform> --live-reload`                                |
| Device to run                        | `wn devices list`, `wn run --device`, `wn devices default --set` |
| Build                                | `wn build`                                                       |
| Build / Run Configuration            | `--config <name>`                                                |
| Sync                                 | `wn sync`                                                        |
| Open in Xcode / Android Studio       | `wn open xcode` / `wn open android-studio`                       |
| Prepare Release                      | `wn release ios` / `wn release android`                          |
| Debug → Web                          | `wn debug web`                                                   |
| Debug → Android WebViews             | `wn debug android --list`, `wn debug android --webview`          |
| Scripts section                      | `wn scripts list`, `wn scripts run`                              |
| Configuration → Properties           | `wn native get` / `wn native set`                                |
| Configuration → Splash Screen & Icon | `wn assets set`, `wn assets generate`                            |
| Check for Minor Updates              | `wn packages minor`                                              |
| Security Audit                       | `wn packages audit`                                              |
| Statistics                           | `wn packages size`                                               |
| Export                               | `wn packages export`                                             |
| Recommendations                      | `wn check`, `wn check --fix <id>`                                |
| Packages / Plugins sections          | `wn packages list`, `wn plugins search`, `wn plugins info`       |
| Plugin Explorer                      | `wn plugins search`, `wn plugins add`                            |
| Upgrade All Packages                 | `wn packages upgrade --all`                                      |
| New Project wizard                   | `wn new`                                                         |
| Angular New → Component/Service/…    | `wn generate <schematic>`                                        |
| Angular migrations and schematics    | `wn migrate angular`, `wn generate migration`                    |
| Capacitor migrations                 | `wn migrate capacitor`                                           |
| Capacitor Migration (from Cordova)   | `wn migrate cordova`                                             |
| SPM Migration                        | `wn migrate spm`                                                 |
| Integrate Capacitor / Add PWA        | `wn integrate capacitor` / `wn integrate pwa`                    |
| Add Android/iOS Project              | `wn native add android` / `wn native add ios`                    |
| Privacy manifest                     | `wn native privacy check` / `wn native privacy add`              |
| Use HTTPS                            | `wn run web --https`, `wn config ssl create`                     |
| Settings                             | `wn config`                                                      |
| Show Logs                            | `--verbose`, `wn run --background` log file                      |
| Stop / Restart                       | `wn stop`                                                        |

## Out of scope

These extension features are UI-specific and have no CLI equivalent: the device preview webview, the Nexus Browser preview window, "Open in Editor", the What's New page, clipboard command detection, inline quick fixes and auto-import code actions, and the error-assistant "Fix this error" inline chat action. The underlying diagnostics are still available as structured `error` events from `--stream-json`, so an agent can act on them itself.
