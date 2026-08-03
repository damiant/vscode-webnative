---
name: web-native-migrate
description: Run project health checks and guided migrations with the WebNative CLI (`npx wn`). Use when auditing a project for problems or recommendations, gating CI on project health, upgrading Capacitor across a major version, migrating Angular to a newer version, converting a Cordova project to Capacitor, migrating iOS from CocoaPods to Swift Package Manager, switching package manager to pnpm or bun, running Angular codemods such as built-in control flow, inject, or signal inputs, or fixing deprecated packages, plugins, and TypeScript compiler options.
---

# WebNative: health checks and migrations

`npx wn` commands for auditing a project and moving it forward a version. These commands change many files at once — the workflows below exist to make that safe. For other tasks see [Related skills](#related-skills).

## CLI contract

- **Always pass `--json`.** Stdout is one object: `{ ok, command, data, errors[], warnings[], durationMs }`. Branch on `errors[].code`, never on message text.
- **`--json` implies no prompting.** Missing required input exits `5` with the valid values in `errors[0].choices` and the flag to use in `errors[0].hint`. Choose one and re-run — never guess a target version or a finding id.
- **Run `wn info --json` first** to learn the framework, package manager, Capacitor version, and monorepo layout.
- **In a monorepo pass `--project <name>`**, from `wn info`'s `monorepo.projects`.
- **`--dry-run`** prints the steps and file changes without applying them. **`--yes`** accepts confirmations but never supplies a missing required value.
- Exit codes: `0` ok, `1` ran but failed, `2` usage error, `3` no project found, `4` missing prerequisite, `5` missing input, `6` blocking check findings, `7` timeout.

Full option lists and payload shapes: [docs.md](../../docs.md).

## Health checks

```bash
wn check --json                                  # all findings, read-only
wn check --severity error --json
wn check --category capacitor,packages --json
wn check --error-on error --json                 # CI gate: exits 6 on any error-level finding
wn check --fix <finding-id> --json               # apply one fix
wn check --ignore <finding-id> --json
wn check --show-ignored --json
```

Findings carry a stable `id`, `severity` (`error`, `warning`, `info`), `category`, `title`, `detail`, and `fixable`:

```json
{
  "findings": [
    {
      "id": "capacitor-version-mismatch",
      "severity": "error",
      "category": "capacitor",
      "title": "@capacitor/android is 6.2.0 but @capacitor/core is 7.2.0",
      "detail": "All @capacitor/* packages must share a major version.",
      "fixable": true
    }
  ],
  "counts": { "error": 1, "warning": 3, "info": 4, "ignored": 2 }
}
```

Categories: `packages`, `capacitor`, `cordova`, `angular`, `typescript`, `android`, `ios`, `browserslist`, `security`, `privacy`. Findings cover Capacitor version consistency and plugin compatibility, deprecated and end-of-life packages, Cordova plugin problems, `config.xml` and `AndroidManifest.xml` settings, `angular.json` issues, deprecated TypeScript compiler options, browserslist, missing platforms, missing privacy manifest entries, and Android `minifyEnabled`.

**Fix findings one at a time**, re-running `wn check` after each. Use `--fix-all` only when the user explicitly asks for a bulk cleanup on a clean git tree.

Error codes: `UNKNOWN_FINDING`, `NOT_FIXABLE`, `FIX_FAILED`.

## Migrations

```bash
wn migrate list --json                     # what applies here, read-only
wn migrate capacitor --to 8 --json
wn migrate angular --to 20 --json
wn migrate cordova --json
wn migrate cordova --remove --json
wn migrate spm --json
wn migrate package-manager pnpm --json
```

| Command           | What it does                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `capacitor`       | Moves to the next Capacitor major (or `--to <major>`), including native file changes and minimum plugin versions. |
| `angular`         | Migrates Angular one major at a time. `--all` repeats to the latest supported major.                              |
| `cordova`         | Converts a Cordova project to Capacitor. `--remove` strips the Cordova project afterwards.                        |
| `spm`             | Migrates iOS from CocoaPods to Swift Package Manager.                                                             |
| `package-manager` | Converts the project to `pnpm`, `bun`, `npm`, or `yarn`.                                                          |

**Always `--dry-run` first and report the plan to the user before applying it.**

Preconditions the CLI enforces, surfaced as exit `1` with a specific code:

- `DIRTY_GIT` — commit or stash first. Do not pass `--yes` to bypass this; the guard is the only way to undo a bad migration.
- `PRECONDITION_FAILED` — a required tool is too old (JDK, Android Studio, CocoaPods) or an installed plugin has no version compatible with the target. `errors[0]` names it.
- `NOT_APPLICABLE` — the migration does not apply to this project.

## Angular codemods

```bash
wn generate migration --list --json
wn generate migration control-flow --json
wn generate migration inject --json
wn generate migration signal-inputs --json
wn generate migration standalone-ionic --json
wn generate migration karma-to-vitest --json
wn generate migration application-builder --json
```

These are optional Angular schematics, separate from a version migration. They rewrite source files across the project — commit first, run one at a time, and build after each.

---

## Workflows

### Diagnose a project

```
- [ ] wn info --json
- [ ] wn check --json
- [ ] Group findings by severity; report errors first with their ids
- [ ] Propose fixes and let the user choose
- [ ] wn check --fix <id> --json, one at a time
- [ ] wn check --json to confirm, then wn build --json
```

Report findings by title and severity. Do not apply fixes the user did not ask for — some rewrite native files or change dependency versions.

### Capacitor major upgrade

```
- [ ] git status                              -> must be clean
- [ ] wn info --json                          -> current Capacitor version
- [ ] wn migrate list --json                  -> confirm the target is available
- [ ] wn migrate capacitor --to <n> --dry-run --json   -> report the plan
- [ ] wn migrate capacitor --to <n> --json
- [ ] wn check --json                         -> plugin compatibility fallout
- [ ] wn build --json && wn sync --json
- [ ] wn run ios --device <id> --json         -> verify on both platforms
```

Do one major at a time. If `PRECONDITION_FAILED` names an incompatible plugin, upgrade or replace that plugin first (see `web-native-packages`).

### Angular version migration

```
- [ ] git status                              -> must be clean; do not override with --yes
- [ ] wn migrate list --json                  -> the next supported major
- [ ] wn migrate angular --to <n> --dry-run --json
- [ ] wn migrate angular --to <n> --json
- [ ] wn build --json
- [ ] wn scripts run test --json
- [ ] Commit before moving to the next major
```

Angular migrates one major at a time by design. `--all` chains them, but a failure mid-chain is much harder to unpick — prefer stepping manually and committing between steps.

### Cordova to Capacitor

```
- [ ] wn check --category cordova --json      -> plugins with no Capacitor equivalent
- [ ] Report unsupported plugins to the user and agree on replacements first
- [ ] wn migrate cordova --dry-run --json
- [ ] wn migrate cordova --json
- [ ] wn native add ios --json / wn native add android --json
- [ ] wn assets generate --json
- [ ] wn build --json && wn sync --json
- [ ] wn migrate cordova --remove --json      -> only after the app runs
```

### CI health gate

```bash
wn check --error-on error --json    # exit 6 means blocking findings exist
```

## What not to do

- Do not run a migration without `--dry-run` first.
- Do not bypass the dirty-git guard with `--yes`. Commit or stash instead.
- Do not chain multiple majors in one run when the user needs to review the result.
- Do not use `wn check --fix-all` as a default; fix findings individually so each change is attributable.
- Do not invent a finding id or a target version. Run `wn check --json` or `wn migrate list --json` first.
- Do not hand-edit native files that a migration owns (`Podfile`, `build.gradle`, `AndroidManifest.xml`, `project.pbxproj`) while a migration is pending — re-run the migration instead.

## Related skills

- **`web-native`** — run, build, sync, debug, and release.
- **`web-native-config`** — bundle id, app name, version and build number, icons and splash screens, new projects.
- **`web-native-packages`** — dependencies, upgrades, security audit, Capacitor plugins.
