/**
 * MCP Tools for advanced features (update dependencies, migrations)
 */

import { z } from 'zod';

import { npxCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const updateMinorDependenciesSchema = z.object({
  autoUpdate: z.boolean().optional().describe('Automatically update all outdated packages'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const migrateToSPMSchema = z.object({
  projectPath: z.string().describe('Path to the project folder (must have iOS with CocoaPods)'),
});

/**
 * Run Swift Package Manager migration assistant for iOS projects using CocoaPods
 */
export async function migrateToSPM(args: z.infer<typeof migrateToSPMSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = 'npx cap-spm-migration-assistant';
    const result = await runCommand(command, { cwd: project.projectFolder(), timeout: 300000 });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          projectPath: args.projectPath,
        },
        message: result.success ? 'SPM migration completed' : 'SPM migration failed',
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
        message: 'Failed to run SPM migration',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Check for and update all dependencies to latest minor versions
 */
export async function updateMinorDependencies(args: z.infer<typeof updateMinorDependenciesSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    // Check for outdated packages
    const checkCommand = getOutdatedCommand(project);
    const checkResult = await runCommand(checkCommand, { cwd: project.projectFolder() });

    let outdated: Record<string, unknown> = {};
    const updates: string[] = [];

    try {
      const data = JSON.parse(checkResult.output);
      outdated = data.dependencies || data || {};

      // Build list of packages to update
      for (const [pkg, info] of Object.entries(outdated)) {
        if (typeof info === 'object' && info !== null) {
          const pkgInfo = info as { current?: string; wanted?: string };
          const current = pkgInfo.current;
          const wanted = pkgInfo.wanted;
          if (current && wanted && current !== wanted) {
            updates.push(`${pkg}@${wanted}`);
          }
        }
      }
    } catch {
      // If JSON parsing fails, return the raw output
      outdated = { error: 'Could not parse outdated packages', output: checkResult.output };
    }

    // Auto-update if requested
    let updateResult;
    if (args.autoUpdate && updates.length > 0) {
      const updateCommands = updates.map((pkg) => `${npxCommand(project)} npm install ${pkg}`).join(' && ');
      updateResult = await runCommand(updateCommands, { cwd: project.projectFolder(), timeout: 300000 });
    }

    return JSON.stringify(
      {
        command: args.autoUpdate ? updateResult?.output : checkCommand,
        data: {
          autoUpdate: args.autoUpdate,
          outdated,
          projectPath: args.projectPath,
          updateResult: updateResult?.output,
          updates,
          updatesCount: updates.length,
        },
        message: args.autoUpdate ? `Updated ${updates.length} packages` : `Found ${updates.length} outdated packages`,
        success: checkResult.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to check/update dependencies',
        success: false,
      },
      null,
      2,
    );
  }
}

// Helper functions

function getOutdatedCommand(project: Project): string {
  switch (project.packageManager) {
    case 0: // PackageManager.npm
      return 'npm outdated --json';
    case 1: // PackageManager.yarn
      return 'yarn outdated --json';
    case 2: // PackageManager.pnpm
      return 'pnpm outdated --json';
    case 3: // PackageManager.bun
      return 'npm outdated --json'; // Bun uses npm for this
    default:
      return 'npm outdated --json';
  }
}
