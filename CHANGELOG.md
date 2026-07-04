## Changelog

### Version 2.2.14

- Fix package manager detection for NX monorepos with pnpm/yarn lockfiles at repo root
- Fix Android/iOS detection when Capacitor platform packages are declared in an NX app package.json
- Fix `isCapacitor` detection when `@capacitor/core` is a devDependency
- Fix Angular CLI package manager recommendation for NX monorepos using pnpm or yarn
- Fix NX app package.json merge clearing the root Android manifest when the app folder has no native Android project

### Version 2.2.13

- Angular optional migrations added to project menu
- Migration for deprecated typescript settings

### Version 2.2.11

- Add Angular 22+ migration options in Advanced Actions for Karma to Vitest and Application Builder
- Fix Angular schematic migrations running outside the workspace by using the project folder and package-manager-aware ng invocation
- Fix Angular migration to verify dependencies before `ng update`, offer `node_modules` reinstall when out of sync, warn on dirty git and monorepo subprojects, and skip post-migration steps on failure
- Fix Angular migration running peer dependency cleanup that could suggest downgrading `@angular/*` packages after a successful update
- Fix duplicate browserslist updates during Angular migration
- Fix command runner reporting success when a step fails
- Fix peer dependency cleanup proposing invalid `@unsure` package versions
- Fix peer dependency checks treating `@angular/*` framework packages as plugins, causing spurious errors when optional peers are missing from the project
- Suppress the install node_modules prompt during Angular migration while `ng update` reinstalls dependencies
- Show the Angular migration recommendation in Recommendations for all Angular projects, not only Capacitor apps
- Remove deprecated TypeScript `baseUrl` and `downlevelIteration` options from Angular subproject tsconfigs to fix build failures with TypeScript 5.9+
- Fix deprecated TypeScript config cleanup to follow tsconfig `extends` chains and angular.json references in monorepos
- Fix deprecated TypeScript config cleanup to include parent-folder and repo-root tsconfig files for subfolder Angular projects
- Add a recommendation to fix deprecated TypeScript compiler options when detected in project tsconfigs

### Version 2.2.9

- Fix build command to use `wn:build`, then `ionic:build`, then `build` from package.json for all framework types, instead of hardcoding `vite build`
- Fix serve command to use `wn:serve`, then `ionic:serve`, then `serve`/`dev`/`start` from package.json for all framework types, instead of hardcoding `vite`

### Version 2.2.8

- Update shellOverride. If set to \* will guess the shell.

### Version 2.2.5

- Fix extension activation failure when `HTTPS_PROXY` is set: telemetry (Mixpanel) initialization is now lazy and non-fatal, so proxy environments no longer prevent command registration

### Version 2.2.4

- Stop all running scripts when the extension is deactivated (e.g. on VS Code quit or extension restart)

### Version 2.2.3

- Fix for privacy policy checks on XCode projects for Windows and Linux

### Version 2.2.1

- Add "Restart" button alongside "Stop" button for running scripts to stop and restart the script
- Replace stop button text with a stop icon ($(debug-stop))
- Fix clicking a running task to stop it immediately instead of queuing a new start

### Version 2.2.0

- Performance improvement to cache package information

### Version 2.1.6

- Remove "Reduce Config Files" browserslist tip
- Fix import of @webnativellc/simple-plist to properly access readFileSync and writeFileSync

### Version 2.1.5

- Fix for "Cannot read properties of undefined (reading 'replace') at finishCommand"

### Version 2.1.4

- Handle serve command where vite is used.

### Version 2.1.3

- Handle where the serve command cannot be determined.

### Version 2.1.2

- When you change package.json outside of the extension the UI will automatically update.

### Version 2.1.1

- Migrate to Angular 21 now updates browserlist for compatibility
- Fix status bar items for running for web / debug (can now click without activating the extension)

### Version 2.1.0

- Support for Capacitor 8 migration
- Fix errors with Copilot

### Version 2.0.58

- Update dependencies

### Version 2.0.57

- Add Support for Angular 21

### Version 2.0.56

- Added setting `webnative.disableClipboardCommandDetection` to disable command detection and auto-run from clipboard
- Clipboard command detection now respects this setting in extension activation

### Version 2.0.55

- add SPM migration assistant for iOS projects
- Support for bun dev server projects

### Version 2.0.54

- Refactoring project and cleanup of integrations

### Version 2.0.53

- Fix pnpm project to use pnpm exec rather than pnpx

### Version 2.0.52

- Fix live reload on Windows by using start /B for parallel process execution

### Version 2.0.51

- Fix issue with generating splash screen and icon assets for a pnpm based project

### Version 2.0.50

- Fix to prevent --project being added for cap run commands

### Version 2.0.49

### Version 2.0.47

- Option to set the Android debugging webroot to use the workspace folder or www folder

### Version 2.0.46

- Set SigningType to ApkSigner by default when preparing Android builds

### Version 2.0.45

- Fix to point QR Code via webnative.app rather than nexusbrowser.com

### Version 2.0.44

- Fix for package installation if package manager is undefined
- Fix to avoid duplicating recommended extensions

### Version 2.0.43

- Fix for setting native project version, build, bundle, display name when project is Android only

### Version 2.0.42

- Avoid calling cocoapods if already called

### Version 2.0.41

- Handle extensions.json with comments in it

### Version 2.0.40

- Package size reduction (removal of typescript-eslint and source maps)

### Version 2.0.39

- Fix "Cannot read properties of null (reading 'edgesOut')" when non-unicode characters found running npm list

### Version 2.0.38

- Support for Bun workspaces

### Version 2.0.37

- Fix to use the default shell for node if available

### Version 2.0.36

- Fix for QR code showing for web based projects

### Version 2.0.35

- Fix for running commands in monorepos
- Fix to show output for scripts that are run

### Version 2.0.33

- Support projects using bun.lock rather than bun.lockb

### Version 2.0.32

- Fix to use package manager specified in settings

### Version 2.0.31

- Fix to show preview on first run

### Version 2.0.30

- Fix to show results of Security Audit

### Version 2.0.28

- Fix for VSCode workspaces on Windows

### Version 2.0.27

- Fix for running native projects opening web preview

### Version 2.0.26

- Remove tests from extension output

### Version 2.0.24

- Angular project now lets you choose the package manager you want to use
- Package manager default selection is now a setting
- Debugging for Vite based projects on Android is now working

### Version 2.0.23

- Run tasks can now choose the configuration to use (eg mode=development)
- Build and run configurations for Vite based projects now find additional modes (eg staging, testing)

### Version 2.0.22

- Fix with Builder feature

### Version 2.0.21

- Support Angular generate schematics for regular Angular projects
- Fix to show editor preview properly for the first time

### Version 2.0.20

- QR Code button for mobile scanning
- Reduce size of extension by replacing Trapeze for native project configuration

### Version 2.0.19

- Setting to open editor on side or tab
- Add padding for the editor
- Close panel on run web
- Fix resizing of the editor
- Open in Browser button on editor

### Version 2.0.17

- Auth for Builder is now in progress dialog

### Version 2.0.16

- Fix auth for Builder
- Change order of tasks

### Version 2.0.12

- Builder import from Figma improvements
- Builder progress messages
- Focus if command has errors
- Fix --host for Angular projects
- Improve packages explorer for web projects
- Can now ignore Capacitor integration
- Created SvelteKit starter
- Created Angular starter
