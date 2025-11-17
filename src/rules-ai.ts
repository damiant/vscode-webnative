import { Project } from './project';
import { QueueFunction, Tip, TipType } from './tip';
import { npx } from './node-commands';
import { showOutput, write, writeAppend, writeWN } from './logging';
import { getRunOutput, replaceAll } from './utilities';
import { InternalCommand } from './command-name';
import { workspace } from 'vscode';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

/**
 * Ensures configToml exists, creates it if missing, and returns its contents.
 * @param {string} workspaceFolder - The root folder of the workspace
 * @returns {string} Contents of configToml
 */
export function ensureConfigToml(workspaceFolder: string): string {
  const configPath = join(workspaceFolder, 'config.toml');
  if (!existsSync(configPath)) {
    // Create with default content (empty or template)
    writeFileSync(configPath, defaultConfigTomlContent(), 'utf8');
  }
  return readFileSync(configPath, 'utf8');
}

function defaultConfigTomlContent(): string {
  return `
model_provider="openrouter"
model="anthropic/claude-haiku-4.5"

[model_providers.openrouter]
name="openrouter"
base_url="https://openrouter.ai/api/v1"
env_key="OPENROUTER_API_KEY"
  `;
}

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

function extFolder(): string | undefined {
  return workspace.workspaceFolders && workspace.workspaceFolders.length > 0
    ? workspace.workspaceFolders[0].uri.fsPath
    : undefined;
}
/**
 * Run OpenAI Codex
 * @param  {QueueFunction} queueFunction
 * @param  {Project} project
 */
async function runOpenAICodex(queueFunction: QueueFunction, project: Project): Promise<void> {
  queueFunction();
  showOutput();
  const apiKey = process.env.OPENROUTER_API_KEY;
  // Use --no flag to prevent npx from downloading if not found locally
  if (!apiKey) {
    write(`[wn] Error: OPENROUTER_API_KEY environment variable not set.`);
    return;
  }
  const config = ensureConfigToml(extFolder());
  const model = 'anthropic/claude-haiku-4.5';
  const cmd = `export CODEX_HOME="${extFolder()}" && ${npx(project)} --no @openai/codex exec --model="${model}" --json "What does this project do?"`;

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
