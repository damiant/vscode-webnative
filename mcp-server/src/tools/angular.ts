/**
 * MCP Tools for Angular code generation
 */

import { z } from 'zod';

import { exists, isGreaterOrEqual } from '../shared/analyzer.js';
import { npxCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const generateAngularSchema = z.object({
  name: z.string().describe('Name for the new Angular artifact (e.g., "my-component")'),
  projectPath: z.string().describe('Path to the project folder'),
  standalone: z.boolean().optional().describe('Generate as standalone component (Angular 15+)'),
  type: z
    .enum(['component', 'page', 'service', 'module', 'class', 'directive'])
    .describe('Type of Angular artifact to generate'),
});

/**
 * Generate Angular components, pages, services, modules, etc.
 */
export async function generateAngular(args: z.infer<typeof generateAngularSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    // Validate Angular project
    if (!exists('@angular/core')) {
      return JSON.stringify(
        {
          error: 'Not an Angular project',
          message: 'This project does not have @angular/core installed',
          success: false,
        },
        null,
        2,
      );
    }

    // Build command
    let command = `${npxCommand(project)} ng generate ${args.type} ${args.name}`;

    // Add standalone flag for Angular 15+
    if (args.standalone !== false) {
      if (isGreaterOrEqual('@angular/core', '15.0.0')) {
        if (args.type === 'component' || args.type === 'page') {
          command += ' --standalone';
        }
      }
    }

    // Special handling for directives
    if (args.type === 'directive') {
      command += ' --skip-import';
    }

    const result = await runCommand(command, { cwd: project.projectFolder() });

    // Parse created files from output
    const createdFiles = parseCreatedFiles(result.output);

    return JSON.stringify(
      {
        command,
        data: {
          createdFiles,
          name: args.name,
          output: result.output,
          projectPath: args.projectPath,
          standalone: args.standalone,
          type: args.type,
        },
        message: result.success
          ? `Created Angular ${args.type} '${args.name}'`
          : `Failed to create Angular ${args.type}`,
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
        message: 'Failed to generate Angular artifact',
        success: false,
      },
      null,
      2,
    );
  }
}

// Helper functions

function parseCreatedFiles(output: string): string[] {
  const files: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (line.includes('CREATE ')) {
      const match = line.match(/CREATE (.+)/);
      if (match) {
        files.push(match[1].trim());
      }
    }
  }

  return files;
}
