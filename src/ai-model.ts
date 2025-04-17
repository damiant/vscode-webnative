import { QuickPickItem, window } from 'vscode';
import { Project } from './project';
import { QueueFunction } from './tip';
import { getSetting, setSetting, WorkspaceSetting } from './workspace-state';
import { getModels, Model, Pricing } from './ai-openrouter';

export async function chatModel(queueFunction: QueueFunction, project: Project) {
  queueFunction();
  const models: Model[] = await getModels();
  models.map((m) => (m.ppm = totalPrice(m.pricing)));
  //models.sort((a, b) => a.name.localeCompare(b.name));
  models.sort((a, b) => a.ppm - b.ppm);
  const currentModel = getSetting(WorkspaceSetting.aiModel);
  const items: QuickPickItem[] = models.map((model) => {
    // {hourly: 0, input: 0, output: 0, base: 0, finetune: 0}
    const price =
      model.pricing.prompt == '0' &&
      model.pricing.completion == '0' &&
      model.pricing.image == '0' &&
      model.pricing.request == '0' &&
      model.pricing.input_cache_read == '0' &&
      model.pricing.input_cache_write == '0' &&
      model.pricing.web_search == '0' &&
      model.pricing.internal_reasoning == '0'
        ? ''
        : `$${totalPrice(model.pricing).toFixed(2)}m`;

    return { label: labelFor(model), description: `(${price})`, picked: model.id == currentModel };
  });
  const result = await window.showQuickPick(items, {
    placeHolder: 'Select an AI Model' + (currentModel ? ` (current model is ${currentModel})` : ''),
    canPickMany: false,
  });
  if (!result) return;
  const model = models.find((m) => labelFor(m) == result.label);
  setSetting(WorkspaceSetting.aiModel, model.id);
}

function labelFor(model: Model): string {
  let icon = '$(file-binary)';
  if (model.architecture.input_modalities.includes('image')) {
    icon = '$(eye)';
  }

  return `${icon} ${model.name}`;
}

function totalPrice(price: Pricing): number {
  const total = v(price.prompt) + v(price.completion);

  return total * 1000000;
}

function v(s: string): number {
  if (!s) return 0;
  return Number(s);
}
