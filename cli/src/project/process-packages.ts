import { Project } from './project';

/** Stub — returns an empty package map until package processing is ported. */
export async function processPackages(
  _folder: string,
  _allDependencies: Record<string, string>,
  _devDependencies: Record<string, string> | undefined,
  _project: Project,
): Promise<Record<string, any>> {
  return {};
}
