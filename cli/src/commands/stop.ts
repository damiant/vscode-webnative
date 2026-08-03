import * as fs from 'fs';
import * as path from 'path';
import { registerCommand } from '../cli/registry';
import { flagBool, flagString } from '../cli/args';
import { killPid } from '../devices/process-list';
import { CliContext } from '../core/context';
import { pidDir } from './run';
import { ensureProject } from './helpers';

interface ManagedProcess {
  name: string;
  kind: string;
  pid: number;
  projectRoot?: string;
  logFile?: string;
}

function loadManaged(): ManagedProcess[] {
  const dir = pidDir();
  if (!fs.existsSync(dir)) return [];
  const results: ManagedProcess[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      results.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    } catch {
      /* ignore */
    }
  }
  return results;
}

function removeManaged(proc: ManagedProcess): void {
  const file = path.join(pidDir(), `${proc.name}-${proc.kind}.json`);
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

async function runStop(ctx: CliContext): Promise<unknown> {
  const all = flagBool(ctx.args.flags, 'all');
  const pidFlag = flagString(ctx.args.flags, 'pid');
  const portFlag = flagString(ctx.args.flags, 'port');

  const stopped: Array<{ pid: number; kind?: string }> = [];

  if (pidFlag) {
    await killPid(Number(pidFlag), ctx.cwd);
    stopped.push({ pid: Number(pidFlag) });
    return { stopped };
  }

  if (portFlag) {
    // Best-effort: kill process listening on port via lsof
    try {
      const out = await ctx.exec.getOutput({ command: `lsof -ti:${portFlag}` }, { ignoreExitCode: true });
      for (const line of out.split('\n')) {
        const pid = Number(line.trim());
        if (pid) {
          await killPid(pid, ctx.cwd);
          stopped.push({ pid });
        }
      }
    } catch {
      /* ignore */
    }
    return { stopped };
  }

  let managed = loadManaged();
  if (!all) {
    try {
      const project = await ensureProject(ctx);
      managed = managed.filter(
        (m) => m.projectRoot === project.folder || m.name === path.basename(project.projectFolder()),
      );
    } catch {
      // no project — stop all for safety when not --all? Prefer only matching cwd
      managed = managed.filter((m) => m.projectRoot === ctx.cwd);
    }
  }

  for (const proc of managed) {
    try {
      await killPid(proc.pid, proc.projectRoot || ctx.cwd);
      stopped.push({ pid: proc.pid, kind: proc.kind });
    } catch {
      /* already dead */
    }
    removeManaged(proc);
  }

  return { stopped };
}

registerCommand({
  name: 'stop',
  description: 'Stop background processes started by wn run',
  run: runStop,
  noProject: true,
});
