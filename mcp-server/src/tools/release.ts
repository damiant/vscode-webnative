/**
 * MCP Tools for preparing release builds with keystore management
 */

import { z } from 'zod';

import { exists, isGreaterOrEqual } from '../shared/analyzer.js';
import { npxCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const prepareReleaseBuildSchema = z.object({
  keyPassword: z.string().optional().describe('Key password (Android only, required for Android builds)'),
  keystoreAlias: z.string().optional().describe('Keystore alias (Android only, required for Android builds)'),
  keystorePassword: z.string().optional().describe('Keystore password (Android only, required for Android builds)'),
  keystorePath: z.string().optional().describe('Path to keystore file (Android only, required for Android builds)'),
  platform: z.enum(['ios', 'android']).describe('Platform to build for'),
  projectPath: z.string().describe('Path to the project folder'),
  releaseType: z
    .enum(['apk', 'aab', 'ipa'])
    .optional()
    .describe('Release type: apk or aab for Android, ipa for iOS (default: aab for Android, ipa for iOS)'),
});

/**
 * Prepare a release build for iOS (.ipa) or Android (.apk or .aab)
 * Requires Capacitor CLI 4.4.0 or higher
 */
export async function prepareReleaseBuild(args: z.infer<typeof prepareReleaseBuildSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    // Check Capacitor CLI version
    if (!isGreaterOrEqual('@capacitor/cli', '4.4.0')) {
      return JSON.stringify(
        {
          error: 'Capacitor CLI version 4.4.0 or higher required',
          message: 'This feature requires Capacitor CLI version 4.4.0 or higher. Please upgrade your Capacitor CLI.',
          success: false,
        },
        null,
        2,
      );
    }

    // Check platform is installed
    const platformPackage = `@capacitor/${args.platform}`;
    if (!exists(platformPackage)) {
      return JSON.stringify(
        {
          error: `Platform ${args.platform} not installed`,
          message: `Please add the ${args.platform} platform first using: npx cap add ${args.platform}`,
          success: false,
        },
        null,
        2,
      );
    }

    // Validate Android keystore parameters
    if (args.platform === 'android') {
      if (!args.keystorePath || !args.keystorePassword || !args.keystoreAlias || !args.keyPassword) {
        return JSON.stringify(
          {
            error: 'Missing Android keystore parameters',
            message:
              'Android release builds require: keystorePath, keystorePassword, keystoreAlias, and keyPassword. ' +
              'You can create a keystore in Android Studio (Build > Generate Signed Bundle).',
            success: false,
          },
          null,
          2,
        );
      }
    }

    // Determine release type
    const releaseType = args.releaseType || (args.platform === 'ios' ? 'ipa' : 'aab');

    // Build command
    let command = `${npxCommand(project)} cap build ${args.platform}`;

    // Add Android-specific parameters
    if (args.platform === 'android') {
      const androidReleaseType = releaseType === 'apk' ? 'APK' : 'AAB';
      command += ` --androidreleasetype=${androidReleaseType}`;
      command += ` --keystorepath="${args.keystorePath}"`;
      command += ` --keystorepass="${args.keystorePassword}"`;
      command += ` --keystorealias="${args.keystoreAlias}"`;
      command += ` --keystorealiaspass="${args.keyPassword}"`;
    }

    // Run the build command with extended timeout (builds can take several minutes)
    const result = await runCommand(command, {
      cwd: project.projectFolder(),
      timeout: 600000, // 10 minutes
    });

    // Parse output to find build location
    let buildPath: string | undefined;
    if (result.success && result.output) {
      const match = result.output.match(/at:\s*(.+)/);
      if (match) {
        buildPath = match[1].trim();
      }
    }

    return JSON.stringify(
      {
        command: command.replace(/--keystorepass="[^"]*"/, '--keystorepass="***"' + ` --keystorealiaspass="***"`),
        data: {
          buildPath,
          output: result.output,
          platform: args.platform,
          projectPath: args.projectPath,
          releaseType,
        },
        message: result.success
          ? `${args.platform === 'ios' ? 'iOS' : 'Android'} release build completed successfully${buildPath ? ` at: ${buildPath}` : ''}`
          : `Failed to prepare ${args.platform === 'ios' ? 'iOS' : 'Android'} release build`,
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to prepare release build',
        success: false,
      },
      null,
      2,
    );
  }
}
