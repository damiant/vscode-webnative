/**
 * MCP Tools for native project configuration (Bundle ID, Display Name, Version, Build Number)
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

import { AndroidProject } from '../shared/native-project-android.js';
import { IosProject } from '../shared/native-project-ios.js';
import { Project } from '../shared/project.js';

export const setBundleIdSchema = z.object({
  bundleId: z.string().describe('New bundle identifier (e.g., "com.company.app")'),
  platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform (default: both)'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const setDisplayNameSchema = z.object({
  displayName: z.string().describe('New display name for the app'),
  platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform (default: both)'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const setVersionSchema = z.object({
  platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform (default: both)'),
  projectPath: z.string().describe('Path to the project folder'),
  version: z.string().describe('New version number (e.g., "1.0.0")'),
});

export const setBuildNumberSchema = z.object({
  buildNumber: z.number().describe('New build number (integer)'),
  platform: z.enum(['ios', 'android', 'both']).optional().describe('Target platform (default: both)'),
  projectPath: z.string().describe('Path to the project folder'),
});

/**
 * Set the build number for iOS and/or Android projects
 */
export async function setBuildNumber(args: z.infer<typeof setBuildNumberSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const platform = args.platform || 'both';
    const results: string[] = [];
    const errors: string[] = [];

    // iOS
    if ((platform === 'ios' || platform === 'both') && existsSync(join(project.projectFolder(), 'ios'))) {
      try {
        const iosProject = new IosProject(join(project.projectFolder(), 'ios', 'App'));
        await iosProject.parse();
        const appTarget = iosProject.getAppTarget();
        if (appTarget) {
          const buildConfigs = iosProject.getBuildConfigurations(appTarget.name);
          for (const config of buildConfigs) {
            await iosProject.setBuild(appTarget.name, config.name, args.buildNumber);
          }
          results.push(`iOS build number updated to ${args.buildNumber}`);
        } else {
          errors.push('iOS app target not found');
        }
      } catch (err) {
        errors.push(`iOS error: ${(err as Error).message}`);
      }
    }

    // Android
    if ((platform === 'android' || platform === 'both') && existsSync(join(project.projectFolder(), 'android'))) {
      try {
        const androidProject = new AndroidProject(join(project.projectFolder(), 'android'));
        await androidProject.parse();
        await androidProject.setVersionCode(args.buildNumber);
        results.push(`Android version code updated to ${args.buildNumber}`);
      } catch (err) {
        errors.push(`Android error: ${(err as Error).message}`);
      }
    }

    return JSON.stringify(
      {
        data: {
          buildNumber: args.buildNumber,
          errors: errors.length > 0 ? errors : undefined,
          platform,
          projectPath: args.projectPath,
          results,
        },
        message:
          errors.length > 0
            ? `Build number update completed with errors: ${errors.join(', ')}`
            : 'Build number updated successfully',
        success: errors.length === 0,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to set build number',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Set the bundle identifier for iOS and/or Android projects
 */
export async function setBundleId(args: z.infer<typeof setBundleIdSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const platform = args.platform || 'both';
    const results: string[] = [];
    const errors: string[] = [];

    // iOS
    if ((platform === 'ios' || platform === 'both') && existsSync(join(project.projectFolder(), 'ios'))) {
      try {
        const iosProject = new IosProject(join(project.projectFolder(), 'ios', 'App'));
        await iosProject.parse();
        const appTarget = iosProject.getAppTarget();
        if (appTarget) {
          const buildConfigs = iosProject.getBuildConfigurations(appTarget.name);
          for (const config of buildConfigs) {
            await iosProject.setBundleId(appTarget.name, config.name, args.bundleId);
          }
          results.push(`iOS bundle ID updated to ${args.bundleId}`);
        } else {
          errors.push('iOS app target not found');
        }
      } catch (err) {
        errors.push(`iOS error: ${(err as Error).message}`);
      }
    }

    // Android
    if ((platform === 'android' || platform === 'both') && existsSync(join(project.projectFolder(), 'android'))) {
      try {
        const androidProject = new AndroidProject(join(project.projectFolder(), 'android'));
        await androidProject.parse();
        await androidProject.setPackageName(args.bundleId);
        results.push(`Android package name updated to ${args.bundleId}`);
      } catch (err) {
        errors.push(`Android error: ${(err as Error).message}`);
      }
    }

    return JSON.stringify(
      {
        data: {
          bundleId: args.bundleId,
          errors: errors.length > 0 ? errors : undefined,
          platform,
          projectPath: args.projectPath,
          results,
        },
        message:
          errors.length > 0
            ? `Bundle ID update completed with errors: ${errors.join(', ')}`
            : 'Bundle ID updated successfully',
        success: errors.length === 0,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to set bundle ID',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Set the display name for iOS and/or Android projects
 */
export async function setDisplayName(args: z.infer<typeof setDisplayNameSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const platform = args.platform || 'both';
    const results: string[] = [];
    const errors: string[] = [];

    // iOS
    if ((platform === 'ios' || platform === 'both') && existsSync(join(project.projectFolder(), 'ios'))) {
      try {
        const iosProject = new IosProject(join(project.projectFolder(), 'ios', 'App'));
        await iosProject.parse();
        const appTarget = iosProject.getAppTarget();
        if (appTarget) {
          const buildConfigs = iosProject.getBuildConfigurations(appTarget.name);
          for (const config of buildConfigs) {
            await iosProject.setDisplayName(appTarget.name, config.name, args.displayName);
          }
          results.push(`iOS display name updated to "${args.displayName}"`);
        } else {
          errors.push('iOS app target not found');
        }
      } catch (err) {
        errors.push(`iOS error: ${(err as Error).message}`);
      }
    }

    // Android
    if ((platform === 'android' || platform === 'both') && existsSync(join(project.projectFolder(), 'android'))) {
      try {
        const androidProject = new AndroidProject(join(project.projectFolder(), 'android'));
        await androidProject.parse();
        androidProject.setDisplayName(args.displayName);
        results.push(`Android display name updated to "${args.displayName}"`);
      } catch (err) {
        errors.push(`Android error: ${(err as Error).message}`);
      }
    }

    return JSON.stringify(
      {
        data: {
          displayName: args.displayName,
          errors: errors.length > 0 ? errors : undefined,
          platform,
          projectPath: args.projectPath,
          results,
        },
        message:
          errors.length > 0
            ? `Display name update completed with errors: ${errors.join(', ')}`
            : 'Display name updated successfully',
        success: errors.length === 0,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to set display name',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Set the version number for iOS and/or Android projects
 */
export async function setVersion(args: z.infer<typeof setVersionSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const platform = args.platform || 'both';
    const results: string[] = [];
    const errors: string[] = [];

    // iOS
    if ((platform === 'ios' || platform === 'both') && existsSync(join(project.projectFolder(), 'ios'))) {
      try {
        const iosProject = new IosProject(join(project.projectFolder(), 'ios', 'App'));
        await iosProject.parse();
        const appTarget = iosProject.getAppTarget();
        if (appTarget) {
          const buildConfigs = iosProject.getBuildConfigurations(appTarget.name);
          for (const config of buildConfigs) {
            await iosProject.setVersion(appTarget.name, config.name, args.version);
          }
          results.push(`iOS version updated to ${args.version}`);
        } else {
          errors.push('iOS app target not found');
        }
      } catch (err) {
        errors.push(`iOS error: ${(err as Error).message}`);
      }
    }

    // Android
    if ((platform === 'android' || platform === 'both') && existsSync(join(project.projectFolder(), 'android'))) {
      try {
        const androidProject = new AndroidProject(join(project.projectFolder(), 'android'));
        await androidProject.parse();
        await androidProject.setVersionName(args.version);
        results.push(`Android version name updated to ${args.version}`);
      } catch (err) {
        errors.push(`Android error: ${(err as Error).message}`);
      }
    }

    return JSON.stringify(
      {
        data: {
          errors: errors.length > 0 ? errors : undefined,
          platform,
          projectPath: args.projectPath,
          results,
          version: args.version,
        },
        message:
          errors.length > 0
            ? `Version update completed with errors: ${errors.join(', ')}`
            : 'Version updated successfully',
        success: errors.length === 0,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to set version',
        success: false,
      },
      null,
      2,
    );
  }
}
