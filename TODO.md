# Roadmap

- Check target sdk: make sure matches https://capacitorjs.com/docs/android/setting-target-sdk

## Recommendations

- Check .gitignore and look for /android, /ios. If this is the case then recommend committing code.
- Check if android/ios folder under git control and warn if not
- Flag packages pull from git with a warning. If they are not pinned to a commit then flag as an error

## Bugs

- Probably don't need to add ionic:build and ionic:serve when the command is not obvious (always generate)
- Errors not finding code and line number in Angular or some scripts

## Nice To Have

- Detect Xcode not installed and offer suggestion to install
- Detect Android Studio not installed and offer suggestion to install
- Detect Node not install and offer suggestion to install
- When package.json is changed then refresh scripts
- Investigate which tasks make sense to run in the terminal instead of output

### Angular Features

- Regular Angular new component/page/service tip
- Preview a component (html view of it shown in editor)

## Big Features

- Target Mac, Linux & Windows with https://neutralino.js.org/
- Target with Wails (https://wails.io/)
- Target with Electron
- Target with Tauri (https://v2.tauri.app/)
- Welcome style projects page (once you have enough projects from the new projects folder)

### Find

- Inspect all components and have the listed and indexed for search

### CI

- If Github then offer actions for iOS and/or Android builds. Include link to article

### Deploy

- Deploy via service: build then cli to zip folder and ship to cloudflare.

### PWA

- PWA support for React/Vue
- When display name is changed look for `manifest.webmanifest` and change name/shortname
- When PWA support is added set the `name`/`shortname`
- PWA settings page needs `theme_color` and `background_color`
- When setting `theme_color` set in index.html `<meta name="theme-color" content="#F61067">`
- Favicon generator - check `@capacitor/assets` will generate it
- PWA splash screens?

## Features

- Add Type Coverage: https://github.com/plantain-00/type-coverage

## Important

- Use https://github.com/eric-horodyski/chrome117-custom-scheme-bug and check for custom scheme and add warning

## Plugin Explorer

- When searching for a package show spinner
- Dynamically rate packages based on npm/github when searched for

## User Requests

- Feature request from user: Issue #124 - configure shortcuts for starting iOS/Android with particular configuration

## Bugs

- Export Statistics on React v7 projects no longer works due to source maps
  You need to add `build: { sourcemap: true }`, to `vite.config.ts`
- (feat) Run->iOS - if windows then prompt that "This feature requires a Mac"
- (feat) Open in Xcode - Similarly requires a Mac

* (feat) Use Https - if openssl is not installed show an error message
* (fix) If upgrading/changing a package then make sure dev server is stopped
* (fix) When running on web for regular Angular app it doesn't launch the browser

## Features

- (feat) Yarn 3 support
- (feat) Use https://stackoverflow.com/a/22040887 for Android and dont use Julio's SSL plugin

## WebNative App

- Preview App - Rotate device
- Preview App - Dark/Light mode (add 'dark' to class of body)
- (feat) Editor preview - option to rotate
- (feat) Editor preview - dark / light mode switch
- (feat) Support flavors and schemes using the CLI
- (fix) Remote logging for android turn on clearText

## Other

- If you add a @capacitor/plugin then sync should be done as well
- See `tslint.json` and angular 12+ then link to [blog](https://ionicframework.com/blog/eslint-for-ionic-angular/) for migration
- Show git remote url somewhere (`git config --get remote.origin.url`)
- (feat) Debugger for iOS (add breakpoints, inspection etc)
- (feat) info.plist editing
- (1) Getting devices takes some time to run the first time. Make sure logging goes to Output window and if taking > 5 seconds then give user feedback that it may take time
- (2) If you sync but the build didn't work then show suitable error (or trigger build)
- (2) If a project has not been built and you try running on ios/android it could build for you beforehand
- (16) If using say @capacitor/camera then allow editing of info.plist and Android permissions (highlight if empty)
- (4) When running for web, if you close the browser, a button for "Open Browser" should allow opening it again.
- (8) Show preview as soon as "Run on Web" is clicked and show progress until app is ready
- (4) Highlight dev dependencies in some way

- If local address is turned on then show warning on start that Nexus wont work ?
- (feat) Coding standards: Review
  https://github.com/ionic-team/prettier-config
  https://github.com/ionic-team/eslint-config
- (fix) On a Stencil project selecting run in editor doesn't seem to work
- (fix) For a regular Angular project that is in a subfolder it reports not finding www folder when running npx cap copy. But dist exists and the extension can correct that in capacitor.config.ts. The dist folder may be separated by app too so dist/my-app may be where the index.html is located

## Key Bindings

- ALT+X for XCode
- ALT+A for Android Studio
- ALT+S for Sync

## NX

- NX 15, Sync not working
- NX 15, Run iOS/Android not working
- In NX, if project.json is missing a name then add name to it
- In NX, if running the Podfile will fail (seems to be relative node_modules folder issue)
- (bug) Package reconciliation (from root and project)
- (feat) Needs lint, test and e2e nx tasks added (assuming @nxtend/ionic-angular)
- (feat) Detect missing @nxtend/ionic-angular or @nxtend/ionic-react. Option to add
- (feat) Detect missing @nxtend/capacitor. Option to add
- Starters for NX?

## Pin Dependencies

- (4) Recommend applying exact version numbers in package.json rather than ~ or ^ or next

## Certificates

- Certificate setup for Windows (for Live Reload with HTTPS)
- Handle scenario where openssl is not installed
- SSL options for non-angular projects
- Add document on Live Reload with https
- (fix) - Add removal of `@jcesarmobile/ssl-skip` as recommendation

## Android Trust Issues

- Android ([info](https://github.com/react-native-webview/react-native-webview/issues/2147))
- May need an intermediate cert ([info](https://developer.android.com/training/articles/security-ssl))

## Linting

- Recommendation for enhanced linting
- Check eslint.json and show dialog with unchecked rules
- Each rule has name and explanation and link to example
- On checking a new rule run linting
- Show count of lint errors and provide option to lint fix
- Make sure next > prev work for linting
- (8) Amp eslint rules to 11: using https://gist.github.com/dtarnawsky/7c42cec330443c7093976136286b5473

## PWA Helper

Help user to install a PWA using a tooltip

- Chrome browser: show link to install app icon and instructions
- Safari: show share button and "Add to dock"
- Windows, iOS, Android

- Parameters:
  - Time used: (seconds). How long does the user need to use the app before the install option appears. Default 5 mins
  - Messaging: allow message displayed to be customized (eg language)
- Script tag to include in index.html or npm package
