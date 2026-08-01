import { Project, guessFramework, getPackageManager } from './project';
import { checkForMonoRepo } from './monorepo';

export async function inspectProject(cwd: string, selectedProject?: string): Promise<Project> {
  const project = new Project('My Project');
  project.folder = cwd;
  project.packageManager = getPackageManager(cwd, project.repoType);

  await project.analyzer.load(cwd, project);
  project.type = project.isCapacitor ? 'Capacitor' : project.isCordova ? 'Cordova' : 'Other';

  await checkForMonoRepo(project, selectedProject);

  if (project.monoRepo?.folder) {
    project.packageManager = getPackageManager(project.monoRepo.folder, project.repoType);
  }
  if (project.monoRepo?.localPackageJson) {
    await project.analyzer.load(project.monoRepo.folder, project);
  }

  guessFramework(project);

  return project;
}
