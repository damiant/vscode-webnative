# Roadmap

- Check target sdk: make sure matches https://capacitorjs.com/docs/android/setting-target-sdk
- Check .gitignore and look for /android, /ios
- Check if android/ios folder under git control and warn if not

- When adding Capacitor check if www exists and if it doesnt but dist does then set `webDir` to dist
- When adding ios platform or android platform be sure to run sync as second step
- If there is no build step then rather than running `npx undefined` just skip it
- If "The bundledWebRuntime configuration option has been deprecated. Can be safely deleted." then remove option

- Run ios - "no devices" error is xcode missing. Show "To run you'll need XCode installed. Do you want to install it?"
- Run Android - Error on no android studio. Show "To run you'll need Android Studio installed...."
- Run Web - Show [Open In Google Chrome, Open In Editor, Open with Nexus]
- Flag packages pull from git with a warning. If they are not pinned to a commit then flag as an error
- Target Mac, Linux & Windows with https://neutralino.js.org/

- Icon for stop task, Icon for restart task
- When package.json is changed then refresh scripts
- Errors not finding code and line number in Angular or some scripts
- Add a shortcut option+R that will re-run the last script run
- When switching between projects - if its a project like a cloudflare worker then open the scripts by default
- With Scripts - have an option to pretty format them in a tree: eg local-db-list-migration, local-db-apply-migration > local-db . list-migration, apply-migration
- If you run "rebuild node modules" on a folder based mono-repo (eg dust-web) then it will fail
- When running do it in the DEBUG CONSOLE!!!!
  - This way interactive things work (like wrangler dev)
  - You get color coding
  - Hopefully error handling is easier

## Studio

- `Welcome page` - show "New Ionic Project", list of recent projects (icons with framework type, name), search bar to find a project
- `Project page`
  - `Develop` - Runs "serve" which will running:
    - Open Browser - Opens a new default web browser
    - Open Mockup Opens a VS Code window with a phone mockup
    - Shows QR Code for Nexus Browser
  - `iOS, Android` - To do `cap run`
  - `Debug Web` - To debug the app in VS Code
  - `Code`
    - Shows list of all components, pages, services etc
    - Has a quick search to find one and opens it on pressing enter
    - Has a keyboard shortcut to flip between `html > css > ts > html`
    - Buttons for new component, page etc
    - `Preview mode` - Render the look and feel of the page / component
  - `Deploy Page`
    - Prepare Android - APK. Great for upload to play store.
    - Prepare iOS - Generates the IPA:
      - Uploads to a deployment server with generate plist and extracted icon, name and branch and version (plus developer)
      - Provides URL which shows a page that can install the IPA / APK
  - `Capabilities Page`
    - List installed dependencies: filter for plugins, framework, other, capabilities, all
    - View as grid (columns for name, version, rating, official badge, recommended badge, upgrade button)
    - View as cards (like current plugins)
    - Capabilities are plugins like "Screen Reader", "Push Notifications"
    - Plugins may be recommended: tagged in a category and type (eg Play Integrity + Security)
    - Idea is that you can drill into say "Security" and see all related Categories with one plugin per category
    - The best rated plugin show as recommended
    - Alternatives are shown as well
    - Option to purchase a plugin: links to purchase url/home page
- `Targets Page`
  - Allows you to turn on/off/rebuild a target
  - Includes `iOS`, `Android`, `PWA`, `Windows`, `Mac`, `Linux`
- `Cool Features`
  - Eliminate `Sync` by syncing when package.json changes or an install happens
  - Eliminate `Build` by tracking latest changed file
  - `Build Watch`
    - Rebuild `www` and continously re-deploy on a change (a slower but more accurate live-deploy)
    - Rebuild to deploy url (equivalent to netlify deploy)
    - Rebuild to live update (live update to a "dev" version of your app that will reload on volume button press)

## PWA

- PWA support for React/Vue
- When display name is changed look for `manifest.webmanifest` and change name/shortname
- When PWA support is added set the `name`/`shortname`
- PWA settings page needs `theme_color` and `background_color`
- When setting `theme_color` set in index.html `<meta name="theme-color" content="#F61067">`
- Favicon generator - check `@capacitor/assets` will generate it
- PWA splash screens?

## Capacitor 6

- Detect and migrate
- Fix: The bundledWebRuntime configuration option has been deprecated. Can be safely deleted.
- Enable beta with "Experimental Features" option

## Features

- Add Type Coverage: https://github.com/plantain-00/type-coverage

- Generate twitter and og metatags
- Generate social and favicon
- Avoid sharp and @capacitor/assets
- Angular projects that use IonicModule (eg `import { IonicModule } from '@ionic/angular';`) and `@ionic/angular/standalone` or `import { send } from 'ionicons/icons';` will break. Check code for it?
- Customers dont really understand the upgrade process in packages/plugins - looking in the "plugins" windows:
- Need to recommend upgrading minor versions of Capacitor on a regular basis (eg monthly)
- Need to recommend upgrading minor versions of Capacitor plugins on a regular basis (eg monthly)
- Angular standalone templates when a component is added (eg `ion-header`) will error until imported correctly. Add an auto-import feature?
- For Capacitor 5 check deployment target is ios >= 13
- Find: Search for all pages, components, routes etc and put in a search box to speed up opens
- Alt+T: Toggle between html/scss and ts

- Starters for Angular add `settings.json` in `.vscode` with {

```json
  "typescript.preferences.autoImportFileExcludePatterns": [
    "@ionic/angular/common",
    "@ionic/angular"
  ],
```

}
Check `main.ts` for `provideIonicAngular` and apply this if missing

- Update docs on capacitorjs.com
- Recommendation for experimental migration to Angular standalone components
- Recommendation for experimental migration to Angular built-in control flow syntax
- Recommendation of migration to @ionic/angular (major versions) and link to migration doc

- eslint-plugin-unused-imports

## Important

- Use https://github.com/eric-horodyski/chrome117-custom-scheme-bug and check for custom scheme and add warning

## Plugin Explorer

- (feat) Add Electron to targets ??
- (feat) Add "Enterprise Ready" and "Capacitor Core" to filters of plugin explorer (per Max)
- On hover over rating show: star count, forks, watchers, issues and link to explanation of rating.
- When searching for a package show spinner
- Dynamically rate packages based on npm/github when searched for
- 3 dots for packages should plugin explorer info for the package

## Rules

- (feat) Migrate from live updates cordova plugin to new plugin (is it ready)

## User Requests

- Feature request from user: Issue #124 - configure shortcuts for starting iOS/Android with particular configuration

## Bugs

- React Vite can write Network: rather than External:

* Use HTTPS on windows doesnt work

- Export Statistics on React v7 projects no longer works due to source maps
  You need to add `build: { sourcemap: true }`, to `vite.config.ts`
- (feat) Run->iOS - if windows then prompt that "This feature requires a Mac"
- (feat) Open in Xcode - Similarly requires a Mac

* (feat) Use Https - if openssl is not installed show an error message
* (fix) If upgrading/changing a package then make sure dev server is stopped
* (fix) When running on web for regular Angular app it doesn't launch the browser

## Features

- (feat) Yarn 3 support
- (feat) if @angular/core >= 14 and no .eslintrc.json or exists(tslint) then recommend eslint migration:
- (feat) Use https://stackoverflow.com/a/22040887 for Android and dont use Julio's SSL plugin

* (feat) Open in Editor as web site (click near QR Code)

- Preview App - Rotate device
- Preview App - Dark/Light mode (add 'dark' to class of body)
- (feat) Preview in Editor - Show Device Name with Check mark
- (feat) Editor preview - option to rotate
- (feat) Editor preview - dark / light mode switch
- (feat) Support flavors and schemes using the CLI
- (fix) Remote logging for android turn on clearText
- If you add a @capacitor/plugin then sync should be done as well
- See `tslint.json` and angular 12+ then link to [blog](https://ionicframework.com/blog/eslint-for-ionic-angular/) for migration
- Show git remote url somewhere (`git config --get remote.origin.url`)
- (feat) Debugger for iOS (add breakpoints, inspection etc)
- (feat) info.plist editing
- (1) Getting devices takes some time to run the first time. Make sure logging goes to Output window and if taking > 5 seconds then give user feedback that it may take time
- (2) If you sync but the build didn't work then show suitable error (or trigger build)
- (2) If a project has not been built and you try running on ios/android it could build for you beforehand
- (2) Show gotchas page for Angular migration x to x+1
- (2) On Web projects that are Angular based hook up dist or configured folder
- (16) If using say @capacitor/camera then allow editing of info.plist and Android permissions (highlight if empty)
- (4) When running for web, if you close the browser, a button for "Open Browser" should allow opening it again.
- (8) Show preview as soon as "Run on Web" is clicked and show progress until app is ready
- (4) Highlight dev dependencies in some way
- (4) Detect if Android Studio not installed
- (perf) Only run capacitor config commands when "Configuration" is expanded

## Other

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

## Ionitron / ChatGPT

- Add a "Ask Ionitron" button when error dialogs are shown
- Give brief that Ionitron can give solutions to errors but requires Chat GPT API Key
- Write Chat GPT output to the output window and show dialog for next prompt
- Add "Ask Ionitron" in the task list

## View Style

Alternative visual web views:

- Run iOS, Android - Show lists of devices and option to run as live reload
- Splash, Icon, Settings - Named Configuration allow visuals
- Support - Link for feedback, framework, each of the components
- Angular - New components, Show existing pages, components, and settings files

## QR Preview

- Button on Toolbar for Build
- Button on Toolbar for Run Web, Run iOS, Run Android
- Click QR Code to display "Use the 'Capacitor View' App to open this application

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

## App Flow

- Listing recent Appflow builds and allowing users to sideload the artifacts from those builds onto their simulators/devices (lots of potential cert issues with iOS here)
- Augmenting the New Project functionality to create the app in appflow and begin with the project linked, similar to the Ionic App Wizard
- Starting an appflow trial directly from the extension… thinking a 1-click experience to install AC/IV/etc

## Ditch Ionic CLI

- Check `package.json` for missing `name` and `version` and set if needed
- Avoid `ionic init` and instead guess best npm run script based on `package.json` having React,Vue,Nuxt etc.
- Guess `dist` folder based on `package.json`
- Guess IP Address, Port based on logged output

## Project Config

- Bundle ID
- Display Name
- Version Number
- Build Number
- Splash (screen, dark, icon, icon background, icon foreground)

- Android Manifest
- Info.plist
- Plugins
- Packages
- Settings + Advanced Settings

- Security Audit
- Statistics
- Export

- Remove "check for minor updates"

## PWA Helper

Help user to install a PWA using a tooltip

- Chrome browser: show link to install app icon and instructions
- Safari: show share button and "Add to dock"
- Windows, iOS, Android

- Parameters:
  - Time used: (seconds). How long does the user need to use the app before the install option appears. Default 5 mins
  - Messaging: allow message displayed to be customized (eg language)
- Script tag to include in index.html or npm package
