## Changelog

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
