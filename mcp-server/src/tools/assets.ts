/**
 * MCP Tools for asset generation (splash screens and icons)
 */

import { z } from 'zod';

import { exists } from '../shared/analyzer.js';
import { npxCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const rebuildAssetsSchema = z.object({
  darkMode: z.boolean().optional().describe('Generate dark mode variants (default: false)'),
  projectPath: z.string().describe('Path to the project folder'),
});

/**
 * Rebuild splash screens and icons for iOS and Android using @capacitor/assets
 * This generates app icons and splash screens from source images in the resources folder
 */
export async function rebuildAssets(args: z.infer<typeof rebuildAssetsSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    // Check if @capacitor/assets is installed
    if (!exists('@capacitor/assets')) {
      return JSON.stringify(
        {
          data: {
            installCommand: `npm install -D @capacitor/assets`,
            projectPath: args.projectPath,
          },
          error: '@capacitor/assets is not installed',
          message:
            'Please install @capacitor/assets first using: npm install -D @capacitor/assets\n' +
            'Then place your icon.png and splash.png files in the resources folder.',
          success: false,
        },
        null,
        2,
      );
    }

    // Build the command
    let command = `${npxCommand(project)} capacitor-assets generate`;
    if (args.darkMode) {
      command += ' --iconBackgroundColor #000000 --iconBackgroundColorDark #FFFFFF';
    }

    // Run the asset generation with a longer timeout
    const result = await runCommand(command, {
      cwd: project.projectFolder(),
      timeout: 120000, // 2 minutes for asset generation
    });

    return JSON.stringify(
      {
        command,
        data: {
          darkMode: args.darkMode,
          output: result.output,
          projectPath: args.projectPath,
        },
        message: result.success
          ? 'Assets generated successfully. Splash screens and icons have been created for iOS and Android.'
          : 'Failed to generate assets. Make sure you have icon.png and splash.png in your resources folder.',
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
        message: 'Failed to rebuild assets',
        success: false,
      },
      null,
      2,
    );
  }
}
