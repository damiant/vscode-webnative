---
name: web-native-packages
description: Manage dependencies and Capacitor plugins with the WebNative CLI (`npx wn`). Use when listing outdated packages, upgrading a dependency to a specific or latest version, applying minor and patch updates, running a security audit for vulnerabilities, resolving unmet peer dependencies, finding deprecated or end-of-life packages, searching for and installing a Capacitor or Cordova plugin, checking plugin platform compatibility or Android permissions, or analyzing bundle size across npm, pnpm, yarn, and bun projects.
---

# WebNative: dependencies and plugins

`npx wn` commands for packages and Capacitor plugins. Works across npm, pnpm, yarn, and bun — the package manager is detected from the lockfile. For other tasks see [Related skills](#related-skills).

## CLI contract

- **Always pass `--json`.** Stdout is one object: `{ ok, command, data, errors[], warnings[], durationMs }`. Branch on `errors[].code`, never on message text.
- **`--json` implies no prompting.** Missing required input exits `5` with the valid values in `errors[0].choices` and the flag to use in `errors[0].hint`. Choose one and re-run — never guess a version or package name.
- **Run `wn info --json` first** to learn the package manager, framework, and Capacitor version.
- **In a monorepo pass `--project <name>`**, from `wn info`'s `monorepo.projects`. `wn packages audit` is workspace-wide and ignores it.
- **`--dry-run`** prints the shell commands without running them. **`--yes`** accepts confirmations but never supplies a missing required value.
- Exit codes: `0` ok, `1` ran but failed, `2` usage error, `3` no project found, `4` missing prerequisite, `5` missing input, `6` blocking check findings, `7` timeout.

Full option lists and payload shapes: [docs.md](../../docs.md).

## Inspect

```bash
wn packages list --json
wn packages list --outdated --json
wn packages list --plugins --json
wn packages peers --json
wn packages audit --json
```

All read-only. `wn packages list` reports `current`, `wanted`, `latest`, and `deprecated` per package:

```json
{
  "packages": [
    { "name": "@angular/core", "current": "19.2.1", "wanted": "19.2.9", "latest": "20.1.0", "type": "dependency" },
    { "name": "moment", "current": "2.30.1", "latest": "2.30.1", "deprecated": true, "type": "dependency" }
  ],
  "plugins": [{ "name": "@capacitor/camera", "current": "7.0.1", "latest": "7.0.2", "ios": true, "android": true }]
}
```

`wanted` is the highest version satisfying the existing range — safe. `latest` may be a new major — needs review.

## Install and remove

```bash
wn packages add date-fns --json
wn packages add vitest --dev --json
wn packages remove moment --json
wn packages install --json                 # install all dependencies
wn packages install --frozen-lockfile --json
```

In a Capacitor project these run `cap sync` afterwards. Pass `--no-sync` to batch several changes and sync once at the end.

## Upgrade

```bash
wn packages upgrade @capacitor/core --version 7.2.0 --json
wn packages upgrade @angular/core --latest --json
wn packages minor --json                   # report available minor/patch updates
wn packages minor --apply --json           # install them in one step
wn packages upgrade --all --json           # everything outdated, including majors
```

Order of preference, safest first: `wn packages minor --apply` for routine maintenance, then single-package `wn packages upgrade --version` for majors, one at a time with a build in between. Reserve `wn packages upgrade --all` for a project the user has explicitly asked to bring fully up to date on a clean git tree.

**All `@capacitor/*` packages must share a major version** — `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`. Upgrade them together in one step, or `wn check` will report a version mismatch. For a Capacitor major upgrade use `wn migrate capacitor` instead, which also handles the native file changes.

Error codes: `UNKNOWN_PACKAGE`, `INSTALL_FAILED`, `INCOMPATIBLE_VERSION`.

## Security and peer dependencies

```bash
wn packages audit --json
wn packages audit --severity high --json
wn packages audit --fix --json
wn packages peers --json
wn packages peers --fix --json
```

`wn packages audit` filters `npm audit` to direct dependencies, so the findings are ones the project can actually act on. `--fix` may change major versions; review the output before applying it to a production project.

`wn packages peers` reports unmet peer dependencies and proposes compatible versions.

## Capacitor plugins

```bash
wn plugins search camera --json
wn plugins search geolocation --platform ios --official --json
wn plugins info @capacitor/camera --json
wn plugins add @capacitor/camera --json
wn plugins remove @capacitor/camera --json
wn plugins permissions --json
```

`wn plugins info` returns npm metadata, repository stats, supported platforms, and — importantly — the version compatible with this project's Capacitor major. `wn plugins add` resolves that version automatically unless you pass `--version`, then runs `cap sync`.

`wn plugins permissions` lists the Android permissions and features each installed plugin contributes, parsed from its `plugin.xml`. Run it before shipping to explain what the app requests.

Error codes: `UNKNOWN_PLUGIN`, `NO_COMPATIBLE_VERSION`, `INSTALL_FAILED`.

## Analysis

```bash
wn packages size --json      # production build plus per-module and per-asset bundle sizes
wn packages export --json    # writes project-summary.md
```

`wn packages export` produces a per-dependency report with version, last release date, and a maintenance rating — useful for answering "what in here is unmaintained?".

`wn packages size` runs a production build, so it is slow. Do not run it as a routine check.

---

## Workflows

### Routine dependency maintenance

```
- [ ] wn packages list --outdated --json
- [ ] wn packages minor --json           -> review what would change
- [ ] wn packages minor --apply --json
- [ ] wn build --json                    -> confirm it still builds
- [ ] wn packages audit --json
```

### Upgrade one package across a major version

```
- [ ] wn packages list --outdated --json      -> confirm current and latest
- [ ] Check the package's own migration notes if it is a framework package
- [ ] wn packages upgrade <name> --version <v> --json
- [ ] wn packages peers --json                -> catch newly unmet peers
- [ ] wn build --json
```

Repeat per package. Never batch several majors into one step — a failure becomes impossible to attribute.

### Add a native capability

```
- [ ] wn plugins search <capability> --json
- [ ] wn plugins info <name> --json       -> check platforms and compatible version
- [ ] wn plugins add <name> --json
- [ ] wn native privacy check --json      -> iOS may now need a reason code
- [ ] wn run ios --device <id> --json     -> verify on a device
```

### Respond to a vulnerability report

```
- [ ] wn packages audit --json                    -> severity counts and affected direct deps
- [ ] wn packages upgrade <name> --version <fixed> --json    -> targeted fix, preferred
- [ ] wn build --json
- [ ] wn packages audit --json                    -> confirm resolved
```

Use `wn packages audit --fix` only when a targeted upgrade is not available, and tell the user it may introduce breaking major versions.

## What not to do

- Do not invent a version number or a plugin name. Run `wn packages list`, `wn plugins search`, or `wn plugins info` first.
- Do not run `wn packages upgrade --all` on a project with uncommitted changes.
- Do not upgrade `@capacitor/*` packages individually — they must stay on the same major.
- Do not edit `package.json` dependency versions by hand and expect the lockfile to follow; use `wn packages add`/`upgrade`.
- Do not run `wn packages size` casually; it triggers a full production build.

## Related skills

- **`web-native`** — run, build, sync, debug, and release.
- **`web-native-config`** — bundle id, app name, version and build number, icons and splash screens, new projects.
- **`web-native-migrate`** — health checks and guided Capacitor, Angular, and Cordova migrations.
