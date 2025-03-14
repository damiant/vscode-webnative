import { ChildProcess } from 'child_process';
import { getRunOutput } from './utilities';

/**
 * Given a process find all child process ids
 * This is used particularly with Windows which does not end all child processes a process created when the parent is killed
 * @param  {string} folder
 * @param  {number} processId
 * @returns Promise of an Array of process ids for the children of processId
 */
export async function getChildProcessIds(folder: string, processId: number): Promise<Array<number>> {
  try {
    const lines = process.platform === 'win32' ? await getWindowsProcessList(folder) : await getMacProcessList(folder);

    const pids = [];
    let idx: number;
    const rel = {};
    for (const line of lines) {
      const txt = line.trim();
      idx = txt.indexOf(' ');
      const childId: number = parseInt(txt.substring(0, idx).trim(), 10);
      const parentId: number = parseInt(txt.substring(idx).trim(), 10);
      if (!isNaN(childId)) {
        if (!rel[parentId]) {
          rel[parentId] = [childId];
        } else {
          rel[parentId].push(childId);
        }
        if (parentId == processId) {
          pids.push(childId);
        }
      }
    }

    // Looks for parents
    for (const pid of pids) {
      const children: Array<number> = rel[pid];
      if (children) {
        for (const child of children) {
          pids.push(child);
        }
      }
    }

    return pids;
  } catch (err) {
    console.error(err);
    return [];
  }
}

/**
 * Kill a process and all child processes
 * @param  {ChildProcess} proc
 * @param  {string} rootPath
 * @returns Promise
 */
export async function kill(proc: ChildProcess, rootPath: string): Promise<void> {
  // This is used to find all child processes that were created (eg npx => ionic => ng)
  const childProcessIds = await getChildProcessIds(rootPath, proc.pid);

  // Kill the parent process
  proc.kill('SIGINT');

  for (const childProcessId of childProcessIds) {
    try {
      process.kill(childProcessId);
    } catch (err) {
      // Some child processes will fail (silently)
    }
  }
}

/**
 * Get Windows process list using powershell gwmi command
 * @param  {string} folder
 * @returns Promise Array of processes with process id and parent process id
 */
async function getWindowsProcessList(folder: string): Promise<Array<string>> {
  return (await getRunOutput('gwmi Win32_Process | select ProcessId, ParentProcessId', folder, 'powershell.exe')).split(
    '\r\n',
  );
}

/**
 * Get Mac Process List using the ps command
 * @param  {string} folder
 * @returns Promise Array of processes with process id and parent process id
 */
async function getMacProcessList(folder: string): Promise<Array<string>> {
  return (await getRunOutput('ps xao pid,ppid', folder)).split('\n');
}
