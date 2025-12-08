/**
 * MCP Tools for project analysis
 */

import { z } from 'zod';

import { generateRecommendations, getPluginCompatibility } from '../rules/capacitor-rules.js';
import { Project } from '../shared/project.js';
import { TipType } from '../shared/tip.js';

export const analyzeProjectSchema = z.object({
  projectPath: z.string().describe('Path to the project folder to analyze'),
});

export async function analyzeProject(args: z.infer<typeof analyzeProjectSchema>) {
  const project = new Project(args.projectPath);
  await project.load();

  return JSON.stringify(project.getSummary(), null, 2);
}

export const getRecommendationsSchema = z.object({
  projectPath: z.string().describe('Path to the project folder to analyze'),
});

export async function getRecommendations(args: z.infer<typeof getRecommendationsSchema>) {
  const project = new Project(args.projectPath);
  await project.load();
  await generateRecommendations(project);

  const tips = project.getTips();
  return JSON.stringify(
    {
      count: tips.length,
      recommendations: tips.map((tip) => tip.toJSON()),
    },
    null,
    2,
  );
}

export const checkPluginCompatibilitySchema = z.object({
  pluginName: z.string().describe('Name of the plugin to check'),
});

export async function checkPluginCompatibility(args: z.infer<typeof checkPluginCompatibilitySchema>) {
  const result = getPluginCompatibility(args.pluginName);
  return JSON.stringify(result, null, 2);
}

export const validateVersionsSchema = z.object({
  projectPath: z.string().describe('Path to the project folder to analyze'),
});

export async function validateVersions(args: z.infer<typeof validateVersionsSchema>) {
  const project = new Project(args.projectPath);
  await project.load();
  await generateRecommendations(project);

  const tips = project.getTips();
  const versionIssues = tips.filter((tip) => tip.type === TipType.Error || tip.type === TipType.Warning);

  return JSON.stringify(
    {
      count: versionIssues.length,
      issues: versionIssues.map((tip) => tip.toJSON()),
    },
    null,
    2,
  );
}
