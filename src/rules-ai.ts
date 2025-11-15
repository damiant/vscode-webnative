import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { npx } from './node-commands';
import { showOutput, writeAppend, writeWN } from './logging';
import { getRunOutput, replaceAll } from './utilities';
import { InternalCommand } from './command-name';

/**
 * Add AI feature to the project
 * @param  {Project} project
 */
export function addAIFeature(project: Project) {
  const tip = new Tip('AI', '', TipType.Idea)
    .setQueuedAction(runOpenAICodex, project)
    .setTooltip('Run OpenAI Codex using npx @openai/codex');

  project.add(tip);
}

/**
 * Run OpenAI Codex
 * @param  {QueueFunction} queueFunction
 * @param  {Project} project
 */
async function runOpenAICodex(queueFunction: QueueFunction, project: Project): Promise<void> {
  queueFunction();
  showOutput();
  // Use --no flag to prevent npx from downloading if not found locally
  const cmd = `export CODEX_HOME="${project.folder}" && export OPENROUTER_API_KEY=${apiKey} && ${npx(project)} --no @openai/codex --provider openrouter exec --json "What does this project do?"`;

  await run(cmd, project);
}

async function run(command: string, project: Project): Promise<void> {
  command = replaceAll(command, InternalCommand.cwd, '');
  writeWN(command);
  getRunOutput(
    command,
    project.folder,
    undefined,
    undefined,
    undefined,
    (data: string) => {
      writeAppend(data);
    },
    (err: string) => {
      writeAppend(err);
    },
  );
}
