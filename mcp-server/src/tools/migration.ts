/**
 * MCP Tools for Capacitor version migrations
 */

import { z } from 'zod';

import { getPackageVersion } from '../shared/analyzer.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

interface MigrationInfo {
  breaking: string[];
  documentation: string;
  manualSteps: string[];
}

export const migrateCapacitorSchema = z.object({
  autoUpgrade: z
    .boolean()
    .optional()
    .describe('Automatically upgrade Capacitor packages (default: false, returns migration info only)'),
  projectPath: z.string().describe('Path to the project folder'),
  targetVersion: z.enum(['4', '5', '6']).describe('Target Capacitor major version to migrate to (4, 5, or 6)'),
});

/**
 * Migrate Capacitor project to a new major version
 * This tool handles package upgrades and provides migration instructions
 */
export async function migrateCapacitor(args: z.infer<typeof migrateCapacitorSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const currentVersion = getPackageVersion('@capacitor/core');
    if (!currentVersion) {
      return JSON.stringify(
        {
          error: '@capacitor/core not found',
          message: 'This does not appear to be a Capacitor project',
          success: false,
        },
        null,
        2,
      );
    }

    const currentMajor = parseInt(currentVersion.split('.')[0]);
    const targetMajor = parseInt(args.targetVersion);

    if (currentMajor >= targetMajor) {
      return JSON.stringify(
        {
          data: {
            currentVersion,
            targetVersion: args.targetVersion,
          },
          message: `Project is already at or above Capacitor ${args.targetVersion}`,
          success: true,
        },
        null,
        2,
      );
    }

    // Get migration information
    const migrationInfo = getMigrationInfo(targetMajor);

    // If autoUpgrade is enabled, perform the upgrade
    if (args.autoUpgrade) {
      const commands: string[] = [];

      // Build npm install commands based on package manager
      const pm = project.packageManager;
      let installCmd = 'npm install';
      if (pm === 0)
        installCmd = 'npm install'; // PackageManager.npm
      else if (pm === 1)
        installCmd = 'yarn add'; // PackageManager.yarn
      else if (pm === 2)
        installCmd = 'pnpm add'; // PackageManager.pnpm
      else if (pm === 3) installCmd = 'bun add'; // PackageManager.bun

      // Upgrade core Capacitor packages
      commands.push(
        `${installCmd} @capacitor/core@^${targetMajor}.0.0 @capacitor/cli@^${targetMajor}.0.0 --save-exact`,
      );

      // Upgrade platform packages if they exist
      const platforms = ['ios', 'android'];
      for (const platform of platforms) {
        const pkg = `@capacitor/${platform}`;
        if (getPackageVersion(pkg)) {
          commands.push(`${installCmd} ${pkg}@^${targetMajor}.0.0 --save-exact`);
        }
      }

      // Upgrade common plugins
      const commonPlugins = [
        '@capacitor/app',
        '@capacitor/haptics',
        '@capacitor/keyboard',
        '@capacitor/status-bar',
        '@capacitor/splash-screen',
        '@capacitor/camera',
        '@capacitor/filesystem',
        '@capacitor/network',
      ];

      for (const plugin of commonPlugins) {
        if (getPackageVersion(plugin)) {
          commands.push(`${installCmd} ${plugin}@^${targetMajor}.0.0`);
        }
      }

      // Execute all upgrade commands
      const results: string[] = [];
      const errors: string[] = [];

      for (const command of commands) {
        const result = await runCommand(command, {
          cwd: project.projectFolder(),
          timeout: 300000, // 5 minutes
        });

        if (result.success) {
          results.push(`Upgraded: ${command.split('@capacitor/')[1]?.split('@')[0] || 'package'}`);
        } else {
          errors.push(`Failed: ${command.split('@capacitor/')[1]?.split('@')[0] || 'package'}`);
        }
      }

      return JSON.stringify(
        {
          data: {
            currentVersion,
            errors: errors.length > 0 ? errors : undefined,
            manualSteps: migrationInfo.manualSteps,
            results,
            targetVersion: args.targetVersion,
          },
          message:
            errors.length > 0
              ? `Migration to Capacitor ${args.targetVersion} completed with some errors. Please review manual steps.`
              : `Successfully upgraded to Capacitor ${args.targetVersion}. Please review and complete the manual migration steps.`,
          success: errors.length === 0,
        },
        null,
        2,
      );
    } else {
      // Return migration information only
      return JSON.stringify(
        {
          data: {
            currentVersion,
            info: migrationInfo,
            targetVersion: args.targetVersion,
          },
          message: `Migration information for Capacitor ${currentMajor} → ${targetMajor}. Use autoUpgrade=true to perform package upgrades.`,
          success: true,
        },
        null,
        2,
      );
    }
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to migrate Capacitor',
        success: false,
      },
      null,
      2,
    );
  }
}

function getMigrationInfo(targetVersion: number): MigrationInfo {
  const migrations: Record<number, MigrationInfo> = {
    4: {
      breaking: [
        'iOS deployment target raised to 13.0',
        'Android target SDK raised to 32 (Android 12)',
        'Removed @capacitor/storage (use @capacitor/preferences instead)',
        'Removed deprecated touchesBegan in AppDelegate',
      ],
      documentation: 'https://capacitorjs.com/docs/updating/4-0',
      manualSteps: [
        'Update iOS deployment target to 13.0 in ios/App/Podfile',
        'Update Android targetSdkVersion to 32 in android/build.gradle',
        'Replace @capacitor/storage with @capacitor/preferences',
        'Update Podfile post_install hook to use assertDeploymentTarget',
        'Add android:exported="true" to MainActivity in AndroidManifest.xml',
      ],
    },
    5: {
      breaking: [
        'iOS deployment target raised to 13.0',
        'Android target SDK raised to 33 (Android 13)',
        'Java 17 required for Android builds',
        'Cordova plugins must be updated to Capacitor 5 compatible versions',
      ],
      documentation: 'https://capacitorjs.com/docs/updating/5-0',
      manualSteps: [
        'Update Android Studio to Flamingo or later',
        'Ensure Java 17 is installed and configured',
        'Update android/build.gradle to use Java 17',
        'Update gradle wrapper to 8.0 or later',
        'Review and update incompatible plugins',
      ],
    },
    6: {
      breaking: [
        'iOS deployment target raised to 14.0',
        'Android minSdkVersion raised to 24',
        'Android target SDK raised to 34 (Android 14)',
        'Java 17 required (Java 18-20 supported)',
        'Kotlin 1.9+ recommended for Android',
      ],
      documentation: 'https://capacitorjs.com/docs/updating/6-0',
      manualSteps: [
        'Update iOS deployment target to 14.0 in ios/App/Podfile',
        'Update Android minSdkVersion to 24 in android/variables.gradle',
        'Update Android targetSdkVersion to 34 in android/variables.gradle',
        'Update gradle wrapper to 8.2 or later',
        'Review iOS privacy manifest requirements',
        'Update Kotlin version to 1.9+ in android/build.gradle',
      ],
    },
  };

  return (
    migrations[targetVersion] || {
      breaking: [],
      documentation: 'https://capacitorjs.com/docs/updating',
      manualSteps: ['Please refer to the official Capacitor documentation for migration steps'],
    }
  );
}
