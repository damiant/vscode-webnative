/**
 * MCP Tools for package management (install, uninstall, audit)
 */

import { z } from 'zod';

import { npmInstallAllCommand, npmInstallCommand, npmUninstallCommand } from '../shared/node-commands.js';
import { runCommand } from '../shared/process.js';
import { Project } from '../shared/project.js';

export const installAllDependenciesSchema = z.object({
  projectPath: z.string().describe('Path to the project folder'),
});

export const installPackageSchema = z.object({
  isDev: z.boolean().optional().describe('Install as dev dependency'),
  packageName: z.string().describe('Name of the package to install'),
  projectPath: z.string().describe('Path to the project folder'),
  version: z.string().optional().describe('Specific version to install (e.g., "1.2.3")'),
});

export const uninstallPackageSchema = z.object({
  packageName: z.string().describe('Name of the package to uninstall'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const auditSecuritySchema = z.object({
  autoFix: z.boolean().optional().describe('Automatically fix vulnerabilities'),
  projectPath: z.string().describe('Path to the project folder'),
});

/**
 * Run npm audit to check for security vulnerabilities
 */
export async function auditSecurity(args: z.infer<typeof auditSecuritySchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    // Run audit
    const auditCommand = 'npm audit --json';
    const auditResult = await runCommand(auditCommand, { cwd: project.projectFolder() });

    let vulnerabilities: Record<string, unknown> = {};
    let fixCommand: string | undefined;
    let fixResult: { output: string; success: boolean } | undefined;

    try {
      const auditData = JSON.parse(auditResult.output);
      vulnerabilities = auditData.vulnerabilities || {};

      // Auto-fix if requested
      if (args.autoFix && Object.keys(vulnerabilities).length > 0) {
        fixCommand = 'npm audit fix';
        fixResult = await runCommand(fixCommand, { cwd: project.projectFolder() });
      }
    } catch {
      // If JSON parsing fails, try to extract info from text output
      vulnerabilities = { error: 'Could not parse audit results', output: auditResult.output };
    }

    const vulnCount = Object.keys(vulnerabilities).length;

    return JSON.stringify(
      {
        command: fixCommand || auditCommand,
        data: {
          autoFix: args.autoFix,
          fixOutput: fixResult?.output,
          projectPath: args.projectPath,
          vulnerabilities,
          vulnerabilityCount: vulnCount,
        },
        message: args.autoFix
          ? `Found ${vulnCount} vulnerabilities, fix ${fixResult?.success ? 'succeeded' : 'failed'}`
          : `Found ${vulnCount} vulnerabilities`,
        success: auditResult.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to run security audit',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Install all project dependencies (npm install)
 */
export async function installAllDependencies(args: z.infer<typeof installAllDependenciesSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = npmInstallAllCommand(project);
    const result = await runCommand(command, { cwd: project.projectFolder(), timeout: 300000 });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          projectPath: args.projectPath,
        },
        message: result.success ? 'Dependencies installed successfully' : 'Failed to install dependencies',
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
        message: 'Failed to install dependencies',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Install an npm package in the project
 */
export async function installPackage(args: z.infer<typeof installPackageSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const packageSpec = args.version ? `${args.packageName}@${args.version}` : args.packageName;
    const command = npmInstallCommand(project, packageSpec, args.isDev || false);
    const result = await runCommand(command, { cwd: project.projectFolder() });

    return JSON.stringify(
      {
        command,
        data: {
          isDev: args.isDev,
          output: result.output,
          packageName: args.packageName,
          projectPath: args.projectPath,
          version: args.version,
        },
        message: result.success
          ? `Package ${args.packageName} installed successfully`
          : `Failed to install ${args.packageName}`,
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
        message: 'Failed to install package',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Remove an npm package from the project
 */
export async function uninstallPackage(args: z.infer<typeof uninstallPackageSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = npmUninstallCommand(project, args.packageName);
    const result = await runCommand(command, { cwd: project.projectFolder() });

    return JSON.stringify(
      {
        command,
        data: {
          output: result.output,
          packageName: args.packageName,
          projectPath: args.projectPath,
        },
        message: result.success
          ? `Package ${args.packageName} uninstalled successfully`
          : `Failed to uninstall ${args.packageName}`,
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
        message: 'Failed to uninstall package',
        success: false,
      },
      null,
      2,
    );
  }
}
