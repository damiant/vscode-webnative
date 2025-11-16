# WebNative VS Code Extension - AI Coding Agent Instructions

## Critical Build Workflow

**After ANY code change, run `npm run build:all` and fix errors before committing.** This builds TypeScript source, plus 3 Angular sub-projects (plugin-explorer, preview, starter).

Build commands:

- `npm run build:all` - Full compile + build all Angular projects
- `npm run compile` - TypeScript only (fast iteration)
- `npm run watch` - Watch mode for development

## Core Architecture: Tip-based Recommendation System

The extension's UX is built around **Tips** (actions/recommendations) organized into **Recommendations** (tree groups). This is NOT a typical command-based extension.

### Tip Pattern (fluent builder)

```typescript
new Tip('Title', 'message', TipType.Apple)
  .setQueuedAction(myFunction, project, arg1) // Function signature: (queueFunction: QueueFunction, ...args)
  .setTooltip('Description')
  .canIgnore() // User can dismiss
  .canAnimate() // Shows progress animation
  .showProgressDialog(); // Modal progress
```

Key methods:

- `.setQueuedAction()` - Most common, queues task with `queueFunction()` callback to mark as running
- `.setDynamicCommand()` - For commands that run processes (build, serve, run)
- `.setAction()` - Immediate execution
- `.canStop()` - Adds stop button for long-running tasks
- `.willNotBlock()` - Task runs without queuing

### Adding New Features: Complete Workflow

**Example: Adding "SPM Migration" feature for iOS projects with CocoaPods**

#### Step 1: Create Action Module (`src/capacitor-spm-migration.ts`)

```typescript
import { Project } from './project';
import { QueueFunction } from './tip';
import { runInTerminal } from './terminal';

/**
 * Run the SPM Migration Assistant for iOS projects
 * @param queueFunction - MUST be called to mark task as running
 * @param project - Current project instance
 */
export async function runSPMMigration(queueFunction: QueueFunction, project: Project) {
  queueFunction(); // Critical: Marks task as running in queue
  runInTerminal('npx cap spm-migration-assistant');
}
```

#### Step 2: Add to Recommendation Function (`src/rules-capacitor.ts`)

```typescript
// At top of file - import your new module
import { runSPMMigration } from './capacitor-spm-migration';

// Inside capacitorRecommendations() function, after iOS project check:
export async function capacitorRecommendations(project: Project, forMigration: boolean): Promise<Tip[]> {
  const tips: Tip[] = [];

  // ... existing code ...

  // SPM Migration Feature (iOS only with CocoaPods)
  if (project.hasCapacitorProject(CapacitorPlatform.ios)) {
    const podfilePath = join(project.projectFolder(), 'ios', 'App', 'Podfile');
    if (existsSync(podfilePath)) {
      tips.push(
        new Tip('SPM Migration', '', TipType.Apple)
          .setQueuedAction(runSPMMigration, project)
          .setTooltip('Run the Swift Package Manager migration assistant for iOS projects'),
      );
    }
  }

  return tips;
}
```

#### Step 3: Build and Test

```bash
npm run build:all  # REQUIRED after every code change
# Fix any TypeScript errors
# Test feature appears in VS Code tree view under "Recommendations"
```

#### Decision Points for Feature Placement

**Where to add your feature:**

1. **`capacitorRecommendations()` in `rules-capacitor.ts`**

   - Use for: Plugin recommendations, Capacitor migrations, platform-specific features
   - Returns: Array of tips added to "Recommendations" section
   - Example: SPM Migration, Add iOS Project, PWA Integration

2. **`getRecommendations()` in `recommend.ts`**

   - Use for: Core project actions (Run, Build, Sync)
   - Creates: Top-level groups via `project.setGroup()`
   - Example: Run for Web, Debug, Build actions

3. **`checkCapacitorRules()` in `rules-capacitor.ts`**

   - Use for: Validation errors, version checks, incompatible plugins
   - Uses: `project.tip()` to add warnings/errors
   - Example: Minimum version checks, migration warnings

4. **`reviewCapacitorConfig()` in `capacitor-configure.ts`**
   - Use for: Native project configuration (bundle ID, version, build number)
   - Creates: Editable properties under "Configuration > Properties"
   - Example: Bundle Id, Display Name, Version Number

#### Feature Patterns

**Pattern 1: Simple Command Execution**

```typescript
async function myFeature(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  runInTerminal('npx my-command');
}
```

**Pattern 2: With User Interaction**

```typescript
async function setFeature(queueFunction: QueueFunction, currentValue: string, project: Project) {
  const newValue = await window.showInputBox({
    title: 'Enter Value',
    value: currentValue,
    validateInput: (value) => (value ? null : 'Cannot be empty'),
  });
  if (!newValue) return; // User cancelled

  queueFunction();
  // ... perform action
}
```

**Pattern 3: Multi-step with Progress**

```typescript
async function complexFeature(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  await showProgress('Doing complex work...', async () => {
    write('Step 1...');
    await doStep1();
    write('Step 2...');
    await doStep2();
  });
  showOutput(); // Show output channel to user
}
```

#### Conditional Display Logic

**Show feature only when conditions are met:**

```typescript
// Check package exists
if (exists('@capacitor/ios')) {
  tips.push(myTip);
}

// Check version
if (isGreaterOrEqual('@capacitor/core', '4.4.0')) {
  tips.push(myTip);
}

// Check file exists
const configPath = join(project.projectFolder(), 'capacitor.config.ts');
if (existsSync(configPath)) {
  tips.push(myTip);
}

// Check platform + file combination
if (project.hasCapacitorProject(CapacitorPlatform.ios)) {
  const podfilePath = join(project.projectFolder(), 'ios', 'App', 'Podfile');
  if (existsSync(podfilePath)) {
    tips.push(myTip);
  }
}
```

#### TipType Icons Reference

- `TipType.Apple` - iOS features
- `TipType.Android` - Android features
- `TipType.Capacitor` - General Capacitor features
- `TipType.Build` - Build actions
- `TipType.Run` - Run/serve actions
- `TipType.Error` - Errors/warnings
- `TipType.Idea` - Recommendations
- `TipType.Settings` - Configuration options

## Project Model & Monorepo Support

`Project` class (`src/project.ts`) represents a workspace, with critical properties:

- `repoType: MonoRepoType` - Detects NX, npm workspaces, Yarn, pnpm, Lerna, folder-based
- `packageManager: PackageManager` - npm, yarn, pnpm, bun
- `monoRepo: MonoRepoProject` - Selected project in monorepo
- `isCapacitor/isCordova` - Framework detection
- `hasCapacitorProject(platform)` - Checks if iOS/Android exists

Key methods:

- `project.projectFolder()` - Returns correct folder (handles monorepos)
- `project.add(tip)` - Adds tip to current group
- `project.setGroup(title, message, type, expanded)` - Creates collapsible section

## Analyzer Pattern (Package Detection)

Use `exists()` and version checks from `src/analyzer.ts`:

```typescript
if (exists('@capacitor/ios')) {
  const podfilePath = join(project.projectFolder(), 'ios', 'App', 'Podfile');
  if (existsSync(podfilePath)) {
    // Feature only shows if iOS + CocoaPods
  }
}

if (isGreaterOrEqual('@capacitor/core', '4.4.0')) {
  // Version-specific feature
}
```

Common helpers:

- `exists(pkg)` - Package in dependencies
- `isGreaterOrEqual(pkg, version)` - Version comparison
- `getPackageVersion(pkg)` - Get installed version

## Task Queue System

Tasks are queued via `src/tasks.ts` to prevent conflicts. Use `queueFunction()` callback:

```typescript
async function myAction(queueFunction: QueueFunction, project: Project) {
  queueFunction(); // Marks task as running, prevents concurrent tasks
  // ... do work
}
```

Queue behaviors:

- `willNotBlock()` - Non-blocking tasks (e.g., opening files)
- `doNotWait()` - Skip queue entirely
- `canStop()` - Adds cancellation support

## Native Project Integration

iOS/Android project manipulation via Trapeze wrappers:

- `src/native-project-ios.ts` - IosProject class (Xcode project parsing)
- `src/native-project-android.ts` - AndroidProject class (Gradle manipulation)

Example (from `capacitor-configure.ts`):

```typescript
const iosProject = new IosProject(join(prj.projectFolder(), 'ios', 'App'));
await iosProject.parse();
const appTarget = iosProject.getAppTarget();
await iosProject.setBundleId(appTarget.name, buildConfig.name, newBundleId);
```

## File Naming Conventions

- `rules-*.ts` - Recommendation generators (return Tip arrays)
- `capacitor-*.ts` - Capacitor-specific features
- `native-project-*.ts` - Native platform code
- `monorepo-*.ts` - Monorepo type handlers
- `*-provider.ts` - VS Code TreeDataProviders

## Extension State (Global Singleton)

`exState` in `src/tree-provider.ts` holds runtime state:

```typescript
exState.projectRef; // Current Project instance
exState.context; // ExtensionContext for persistence
exState.hasNodeModules; // Whether node_modules exists
exState.runWeb / runIOS / runAndroid; // Active run tasks
```

## Terminal Integration

Use `runInTerminal()` from `src/terminal.ts` to execute commands in WebNative terminal:

```typescript
import { runInTerminal } from './terminal';
runInTerminal('npx cap sync'); // Shows in WebNative terminal, user sees output
```

## Common Pitfalls

1. **Forgetting `queueFunction()`** - Tasks won't queue properly
2. **Not checking monorepo paths** - Use `project.projectFolder()` not `project.folder`
3. **Missing `existsSync()` checks** - Always verify files exist before reading
4. **Using wrong TipType** - TipType.Apple for iOS, TipType.Android for Android, etc.
5. **Not handling version checks** - Use `isGreaterOrEqual()` not manual semver parsing
