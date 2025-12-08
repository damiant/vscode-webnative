#!/usr/bin/env node
import { FastMCP } from 'fastmcp';

import {
  analyzeProject,
  analyzeProjectSchema,
  checkPluginCompatibility,
  checkPluginCompatibilitySchema,
  getRecommendations,
  getRecommendationsSchema,
  validateVersions,
  validateVersionsSchema,
} from './tools/analysis.js';
import {
  migrateToSPM,
  migrateToSPMSchema,
  updateMinorDependencies,
  updateMinorDependenciesSchema,
} from './tools/advanced.js';
import { generateAngular, generateAngularSchema } from './tools/angular.js';
import { rebuildAssets, rebuildAssetsSchema } from './tools/assets.js';
import { listDevices, listDevicesSchema, runOnDevice, runOnDeviceSchema } from './tools/devices.js';
import { openInIDE, openInIDESchema } from './tools/ide.js';
import { migrateCapacitor, migrateCapacitorSchema } from './tools/migration.js';
import {
  setBuildNumber,
  setBuildNumberSchema,
  setBundleId,
  setBundleIdSchema,
  setDisplayName,
  setDisplayNameSchema,
  setVersion,
  setVersionSchema,
} from './tools/native-config.js';
import {
  auditSecurity,
  auditSecuritySchema,
  installAllDependencies,
  installAllDependenciesSchema,
  installPackage,
  installPackageSchema,
  uninstallPackage,
  uninstallPackageSchema,
} from './tools/packages.js';
import { prepareReleaseBuild, prepareReleaseBuildSchema } from './tools/release.js';
import {
  addPlatform,
  addPlatformSchema,
  buildProject,
  buildProjectSchema,
  syncProject,
  syncProjectSchema,
} from './tools/platform.js';

const server = new FastMCP({
  name: 'WebNative MCP Server',
  version: '1.0.0',
});

// Project Analysis Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: 'Analyze Project',
  },
  description:
    'Analyze a Capacitor/Ionic project and return detailed information about its structure, framework, package manager, monorepo configuration, and installed platforms.',
  execute: async (args) => {
    return await analyzeProject(args);
  },
  name: 'analyze_project',
  parameters: analyzeProjectSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: 'Get Recommendations',
  },
  description:
    'Get actionable recommendations for a project including version checks, plugin compatibility, deprecated packages, and migration suggestions. Returns an array of tips with actions that can be executed.',
  execute: async (args) => {
    return await getRecommendations(args);
  },
  name: 'get_recommendations',
  parameters: getRecommendationsSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: 'Check Plugin Compatibility',
  },
  description: 'Check if a specific plugin is compatible with Capacitor, deprecated, or has recommended replacements.',
  execute: async (args) => {
    return await checkPluginCompatibility(args);
  },
  name: 'check_plugin_compatibility',
  parameters: checkPluginCompatibilitySchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: 'Validate Versions',
  },
  description:
    'Validate package versions in a project and return only errors and warnings about version mismatches, minimum version requirements, or inconsistent versions.',
  execute: async (args) => {
    return await validateVersions(args);
  },
  name: 'validate_versions',
  parameters: validateVersionsSchema,
});

// Platform Management Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Add Platform',
  },
  description: 'Add iOS or Android platform to a Capacitor project. This will run `cap add <platform>` command.',
  execute: async (args) => {
    return await addPlatform(args);
  },
  name: 'add_platform',
  parameters: addPlatformSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Build Project',
  },
  description:
    'Build the web project for production or development. Runs the project build command (ng build, vite build, etc.) and optionally copies assets to native platforms.',
  execute: async (args) => {
    return await buildProject(args);
  },
  name: 'build_project',
  parameters: buildProjectSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Sync Project',
  },
  description:
    'Sync web assets and native dependencies with Capacitor platforms. Runs `cap sync` to update iOS and Android projects with latest web code and plugins.',
  execute: async (args) => {
    return await syncProject(args);
  },
  name: 'sync_project',
  parameters: syncProjectSchema,
});

// Package Management Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Audit Security',
  },
  description:
    'Run npm audit to check for security vulnerabilities in project dependencies. Optionally auto-fix vulnerabilities with npm audit fix.',
  execute: async (args) => {
    return await auditSecurity(args);
  },
  name: 'audit_security',
  parameters: auditSecuritySchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Install All Dependencies',
  },
  description: 'Install all project dependencies by running npm install, yarn install, pnpm install, or bun install.',
  execute: async (args) => {
    return await installAllDependencies(args);
  },
  name: 'install_all_dependencies',
  parameters: installAllDependenciesSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Install Package',
  },
  description: 'Install an npm package in the project. Supports specifying version and installing as dev dependency.',
  execute: async (args) => {
    return await installPackage(args);
  },
  name: 'install_package',
  parameters: installPackageSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Uninstall Package',
  },
  description: 'Remove an npm package from the project dependencies.',
  execute: async (args) => {
    return await uninstallPackage(args);
  },
  name: 'uninstall_package',
  parameters: uninstallPackageSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Update Minor Dependencies',
  },
  description:
    'Check for and optionally update all dependencies to their latest minor versions. Returns list of available updates.',
  execute: async (args) => {
    return await updateMinorDependencies(args);
  },
  name: 'update_minor_dependencies',
  parameters: updateMinorDependenciesSchema,
});

// Device Management Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: 'List Devices',
  },
  description:
    'List available iOS or Android devices and simulators/emulators for running the app. Returns device names and IDs.',
  execute: async (args) => {
    return await listDevices(args);
  },
  name: 'list_devices',
  parameters: listDevicesSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Run On Device',
  },
  description:
    'Build and run the app on a connected iOS or Android device or simulator. Optionally enable live reload for development.',
  execute: async (args) => {
    return await runOnDevice(args);
  },
  name: 'run_on_device',
  parameters: runOnDeviceSchema,
});

// Angular Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Generate Angular Artifact',
  },
  description:
    'Generate Angular components, pages, services, modules, classes, or directives using Angular CLI. Supports standalone components for Angular 15+.',
  execute: async (args) => {
    return await generateAngular(args);
  },
  name: 'generate_angular',
  parameters: generateAngularSchema,
});

// Migration Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Migrate Capacitor',
  },
  description:
    'Migrate Capacitor project to a new major version (4, 5, or 6). Handles package upgrades and provides migration instructions.',
  execute: async (args) => {
    return await migrateCapacitor(args);
  },
  name: 'migrate_capacitor',
  parameters: migrateCapacitorSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Migrate to SPM',
  },
  description: 'Run the Swift Package Manager migration assistant to migrate iOS projects from CocoaPods to SPM.',
  execute: async (args) => {
    return await migrateToSPM(args);
  },
  name: 'migrate_to_spm',
  parameters: migrateToSPMSchema,
});

// Native Project Tools
server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Open in IDE',
  },
  description:
    'Open the native iOS project in Xcode or Android project in Android Studio. Useful for native development and debugging.',
  execute: async (args) => {
    return await openInIDE(args);
  },
  name: 'open_in_ide',
  parameters: openInIDESchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Prepare Release Build',
  },
  description:
    'Prepare a release build for iOS (.ipa) or Android (.apk or .aab). Handles keystore signing for Android builds. Requires Capacitor CLI 4.4.0+.',
  execute: async (args) => {
    return await prepareReleaseBuild(args);
  },
  name: 'prepare_release_build',
  parameters: prepareReleaseBuildSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Rebuild Assets',
  },
  description:
    'Generate splash screens and app icons for iOS and Android from source images using @capacitor/assets. Place icon.png and splash.png in the resources folder.',
  execute: async (args) => {
    return await rebuildAssets(args);
  },
  name: 'rebuild_assets',
  parameters: rebuildAssetsSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Set Build Number',
  },
  description: 'Set the build number for iOS and/or Android projects. Build numbers are incremented for each release.',
  execute: async (args) => {
    return await setBuildNumber(args);
  },
  name: 'set_build_number',
  parameters: setBuildNumberSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Set Bundle ID',
  },
  description:
    'Set the bundle identifier (iOS) or package name (Android) for the native projects. This uniquely identifies your app.',
  execute: async (args) => {
    return await setBundleId(args);
  },
  name: 'set_bundle_id',
  parameters: setBundleIdSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Set Display Name',
  },
  description: 'Set the display name of the app shown on the home screen for iOS and/or Android projects.',
  execute: async (args) => {
    return await setDisplayName(args);
  },
  name: 'set_display_name',
  parameters: setDisplayNameSchema,
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: false,
    title: 'Set Version',
  },
  description:
    'Set the version number for iOS and/or Android projects. Version numbers follow semantic versioning (e.g., 1.0.0).',
  execute: async (args) => {
    return await setVersion(args);
  },
  name: 'set_version',
  parameters: setVersionSchema,
});

// Add resource for current working directory project
server.addResource({
  async load() {
    const cwd = process.cwd();
    return {
      text: `Current working directory: ${cwd}\nUse this path as projectPath parameter for analysis tools.`,
    };
  },
  mimeType: 'text/plain',
  name: 'Current Project Path',
  uri: 'webnative://current-project',
});

server.start({
  transportType: 'stdio',
});
