---
name: web-native-config
description: Configure native mobile project settings and scaffold projects with the WebNative CLI (`npx wn`). Use when setting a Capacitor app's bundle id or app id, display name, version number, or build number, adding an iOS or Android platform, generating app icons and splash screens, handling the Apple privacy manifest, creating a new project from a starter template, generating Angular components, services, or modules, integrating Capacitor or a PWA into an existing web project, or changing CLI settings such as the default port, package manager, or JDK path.
---

# WebNative: configuration and scaffolding

`npx wn` commands for native project settings, assets, scaffolding, and CLI configuration. For the run/build/release loop see [Related skills](#related-skills).

## CLI contract

- **Always pass `--json`.** Stdout is one object: `{ ok, command, data, errors[], warnings[], durationMs }`. Branch on `errors[].code`, never on message text.
- **`--json` implies no prompting.** Missing required input exits `5` with the valid values in `errors[0].choices` and the flag to use in `errors[0].hint`. Choose one and re-run — never guess an id.
- **Run `wn info --json` first** to learn the framework, package manager, and which Capacitor platforms exist.
- **In a monorepo pass `--project <name>`**, from `wn info`'s `monorepo.projects`.
- **`--dry-run`** prints the shell commands without running them. **`--yes`** accepts confirmations but never supplies a missing required value.
- Exit codes: `0` ok, `1` ran but failed, `2` usage error, `3` no project found, `4` missing prerequisite, `5` missing input, `6` blocking check findings, `7` timeout.

Full option lists and payload shapes: [docs.md](../../docs.md).

## Native project settings

```bash
wn native get --json                              # read-only
wn native set app-id com.example.storefront --json
wn native set app-name "Storefront" --json
wn native set version 2.4.0 --json
wn native set build 128 --json
```

Properties: `app-id` (bundle identifier), `app-name` (display name), `version`, `build` (build number).

Without `--platform`, `set` writes both native projects and the Capacitor config, which is what you almost always want. Add `--platform ios` or `--platform android` only when the user explicitly wants the platforms to diverge:

```bash
wn native set build 128 --platform ios --json
```

`wn native get --json` returns per-platform values, so mismatches between iOS and Android are visible before you write:

```json
{
  "ios": { "appId": "com.example.storefront", "appName": "Storefront", "version": "2.4.0", "build": "128" },
  "android": { "appId": "com.example.storefront", "appName": "Storefront", "version": "2.4.0", "build": "127" }
}
```

Changing `app-id` renames Java package folders on Android and rewrites the Xcode project. Use `--dry-run` first and make sure the working tree is committed.

Error codes: `PLATFORM_NOT_ADDED`, `INVALID_VALUE` (bundle id or version format), `WRITE_FAILED`.

## Platforms and privacy manifest

```bash
wn native add ios --json
wn native add android --json
wn native privacy check --json          # read-only
wn native privacy add --json
```

`wn native privacy check` reports whether `PrivacyInfo.xcprivacy` exists and which Apple required-reason API categories the installed plugins need. Run it after adding an iOS plugin. `wn native privacy add` creates the file, registers it in the Xcode project, and adds the reason codes.

## Icons and splash screens

```bash
wn assets list --json                             # read-only: which source images exist
wn assets set icon ./design/icon-1024.png --json
wn assets set splash ./design/splash.png --json
wn assets generate --ios --android --json
```

Asset types: `splash`, `splash-dark`, `icon`, `icon-foreground`, `icon-background`.

`wn assets set` copies a file into `resources/` under the expected name. `wn assets generate` produces every platform size and adds the generated output to `.gitignore`; with no target flag it generates for all installed platforms. Add `--pwa` for web manifest icons.

Error codes: `MISSING_SOURCE_ASSET`, `INVALID_IMAGE` (wrong dimensions), `GENERATE_FAILED`.

## New projects

```bash
wn new --list-templates --json      # read-only
wn new storefront --template ionic-angular-tabs --targets web,ios,android --json
```

List templates before choosing one — never invent a template id. Template ids cover Ionic Angular/React/Vue, Angular CLI, Vite (react, vue, svelte, solid, preact, lit, qwik), Next.js, Nuxt, Astro, SvelteKit, TanStack Start, Hydrogen, and Capacitor plugins.

`--targets` adds and configures the named Capacitor platforms. Other flags: `--framework <id>` to filter the template list, `--dir <path>`, `--package-manager <pm>`, `--no-install`, `--no-git`.

The template choice determines the whole project — ask the user rather than picking for them.

## Integrations

```bash
wn integrate capacitor --app-id com.example.app --json
wn integrate pwa --json
wn integrate prettier --husky --json
```

`wn integrate capacitor` infers `webDir` from `angular.json` `outputPath` or the conventional `www`/`dist`/`build` folder. Pass `--web-dir <dir>` when the project is unconventional, and `--platforms ios,android` to add platforms in the same step.

Error codes: `ALREADY_INTEGRATED`, `MISSING_INPUT`, `INTEGRATE_FAILED`.

## Angular code generation

```bash
wn generate --list --json
wn generate component checkout/payment-form --json
wn generate service data -- --skip-tests --json
```

Schematics: `component`, `service`, `module`, `class`, `directive`, `pipe`, `guard`, `interceptor`, and `page` when `@ionic/angular-toolkit` is installed. Arguments after `--` pass through to `ng generate`.

Prefer this over calling `ng generate` directly — `wn` runs it from the correct project folder with the project's package manager, which matters in a monorepo.

## CLI settings

```bash
wn config list --json
wn config get defaultPort --json
wn config set defaultPort 4200 --json
wn config set packageManager pnpm --global --json
wn config ssl create --json
```

| Key                  | Default         | Purpose                                     |
| -------------------- | --------------- | ------------------------------------------- |
| `defaultPort`        | `8100`          | Base dev server port                        |
| `buildForProduction` | `false`         | Default `--prod` for builds                 |
| `packageManager`     | detected        | `npm`, `pnpm`, `yarn`, `bun`                |
| `javaHome`           | `$JAVA_HOME`    | JDK for Android builds                      |
| `androidSdk`         | `$ANDROID_HOME` | Android SDK location                        |
| `adbPath`            | on `PATH`       | adb binary                                  |
| `internalAddress`    | `false`         | Prefer the internal address for live reload |
| `debugBrowser`       | `chrome`        | `chrome` or `edge`                          |
| `telemetry`          | `true`          | Anonymous usage reporting                   |

Project settings live in `wn.json` at the project root; `--global` writes to `~/.config/wn/config.json`. Precedence is flags, then environment variables, then `wn.json`, then global config, then defaults.

`wn.json` is safe to commit. Signing credentials never belong in it — they come from `WN_KEYSTORE_*` environment variables.

`wn config ssl create` generates the local certificate used by `wn run web --https` and prints the CA certificate path that devices must trust.

---

## Workflows

### Set up a new app's identity

```
- [ ] wn native get --json                 -> see current values and any iOS/Android drift
- [ ] wn native set app-id <reverse.dns.id> --json
- [ ] wn native set app-name "<Display Name>" --json
- [ ] wn assets set icon <file> --json  /  wn assets set splash <file> --json
- [ ] wn assets generate --json
- [ ] wn sync --json
```

### Bump the version before a release

```
- [ ] wn native get --json                 -> read the current version and build
- [ ] wn native set version <semver> --json
- [ ] wn native set build <integer> --json
- [ ] wn native get --json                 -> confirm both platforms match
```

### Add a platform to an existing project

```
- [ ] wn info --json                       -> confirm it is a Capacitor project
- [ ] wn native add android --json
- [ ] wn assets generate --android --json
- [ ] wn sync android --json
```

## What not to do

- Do not edit `capacitor.config.ts`, `Info.plist`, `build.gradle`, `strings.xml`, or the Xcode project by hand for these properties. `wn native set` keeps the Capacitor config and both native projects consistent; hand edits drift.
- Do not change `app-id` on a dirty working tree — it rewrites native files and renames folders.
- Do not invent a template id or an asset type. Run `wn new --list-templates` or `wn assets list` first.
- Do not put secrets in `wn.json`.

## Related skills

- **`web-native`** — run, build, sync, debug, and release.
- **`web-native-packages`** — dependencies, upgrades, security audit, Capacitor plugins.
- **`web-native-migrate`** — health checks and guided migrations.
