# WebNative CLI (`wn`)

Command-line interface for web and mobile app development with Capacitor, Cordova, Ionic, Angular, React, Vue, and related toolchains.

This package lives inside the [vscode-webnative](https://github.com/) repository today and is designed to be extracted to its own project later. It is **completely independent** of the VS Code extension — no shared runtime imports.

## Install / run

```bash
# From this repo during development
node cli/dist/bin.js <command> [options]

# After publish
npx wn <command> [options]
npm install --save-dev wn
```

## Quick start

```bash
wn info --json                 # detect project
wn check --json                # recommendation engine
wn devices list --json         # simulators / emulators / devices
wn run web --background --json # start dev server
wn build --prod --json
wn sync --json
wn stop --json
```

Always pass `--json` from coding agents. Stdout is a single envelope:

```json
{ "ok": true, "command": "info", "data": {}, "warnings": [], "errors": [], "durationMs": 120 }
```

Exit codes: `0` ok, `1` command failed, `2` usage, `3` no project, `4` missing tool, `5` missing input (choices in `errors[0].choices`), `6` blocking checks, `7` timeout.

## Documentation

- Full specification: [docs.md](./docs.md)
- Agent skills: [skill/README.md](./skill/README.md)

## Development

```bash
cd cli
npm install
npm run build
npm test
```

From the repo root, `npm run build:all` includes `build:cli`.

## Independence

All logic under `cli/src` is self-contained. Extension sources were copied and adapted (no `vscode` API, no `exState` globals). A later extraction can move this folder to its own repository without changing the VS Code extension.
