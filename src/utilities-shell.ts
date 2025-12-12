import { access, constants } from 'fs/promises';
import { join } from 'path';
import { workspace } from 'vscode';

let cachedShell: string | undefined;

async function testShell(shellPath: string): Promise<boolean> {
  try {
    // Use fs.access to check if file exists and is executable
    // This avoids command injection by not using shell interpolation
    await access(shellPath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveShellPath(commandOrPath: string): Promise<string | undefined> {
  // If it's already a full path, test it directly
  if (commandOrPath.includes('/')) {
    if (await testShell(commandOrPath)) {
      return commandOrPath;
    }
    return undefined;
  }

  // It's a command name, manually check PATH to avoid command injection
  // Parse PATH environment variable and check each directory
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(':').filter((dir) => dir.length > 0);

  // Also check common system locations
  const commonPaths =
    process.platform === 'darwin'
      ? ['/bin', '/usr/bin', '/usr/local/bin', '/opt/homebrew/bin']
      : ['/bin', '/usr/bin', '/usr/local/bin'];

  // Combine PATH directories with common paths, removing duplicates
  const allPaths = [...new Set([...pathDirs, ...commonPaths])];

  for (const dir of allPaths) {
    // Use path.join to safely construct the path, avoiding command injection
    const testPath = join(dir, commandOrPath);
    if (await testShell(testPath)) {
      return testPath;
    }
  }

  return undefined;
}

export async function guessShell(writeError: (message: string) => void): Promise<string | undefined> {
  if (cachedShell) {
    return cachedShell;
  }

  if (process.platform === 'win32') {
    cachedShell = 'powershell.exe';
    return cachedShell;
  }

  const terminalConfig = workspace.getConfiguration('terminal.integrated');

  // Get the default terminal profile based on platform
  const platformSuffix = process.platform === 'darwin' ? 'osx' : 'linux';
  const profileKey = `defaultProfile.${platformSuffix}`;
  const profilesKey = `profiles.${platformSuffix}`;

  const defaultProfile = terminalConfig.get<string>(profileKey);
  if (defaultProfile) {
    // Look up the actual path from the profiles configuration
    const profiles = terminalConfig.get<Record<string, { path?: string }>>(profilesKey);
    if (profiles && profiles[defaultProfile]) {
      const profilePath = profiles[defaultProfile].path;
      if (profilePath) {
        // Resolve the path (handles both full paths and command names)
        const shellPath = await resolveShellPath(profilePath);
        if (shellPath) {
          cachedShell = shellPath;
          return cachedShell;
        }
      }
    }
  }

  if (process.env.SHELL) {
    if (await testShell(process.env.SHELL)) {
      cachedShell = process.env.SHELL;
      return cachedShell;
    }
  }

  writeError(`Unable to find a valid shell. Tried ${profileKey} and SHELL environment variable.`);
  return undefined;
}
