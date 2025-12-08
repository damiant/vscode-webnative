/**
 * MCP Tools for opening native projects in IDEs (Xcode, Android Studio)
 */

import { z } from 'zod';

import { npxCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const openInIDESchema = z.object({
  platform: z.enum(['ios', 'android']).describe('Platform to open (ios for Xcode, android for Android Studio)'),
  projectPath: z.string().describe('Path to the project folder'),
});

/**
 * Open the native iOS project in Xcode or Android project in Android Studio
 */
export async function openInIDE(args: z.infer<typeof openInIDESchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = `${npxCommand(project)} cap open ${args.platform}`;
    const ideName = args.platform === 'ios' ? 'Xcode' : 'Android Studio';

    // Run the command with a longer timeout since IDEs can take time to open
    const result = await runCommand(command, {
      cwd: project.projectFolder(),
      timeout: 60000, // 60 seconds
    });

    return JSON.stringify(
      {
        command,
        data: {
          ideName,
          output: result.output,
          platform: args.platform,
          projectPath: args.projectPath,
        },
        message: result.success
          ? `${ideName} opened successfully for ${args.platform} project`
          : `Failed to open ${ideName}`,
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    const ideName = args.platform === 'ios' ? 'Xcode' : 'Android Studio';
    return JSON.stringify(
      {
        error: error.message,
        message: `Failed to open ${ideName}`,
        success: false,
      },
      null,
      2,
    );
  }
}
