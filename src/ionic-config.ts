import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface IonicConfig {
  npmClient?: string;
  'git.setup'?: boolean;
  version?: string;
  type: string; // ionic.config.json type
  projects?: any;
  defaultProject?: string;
}

/**
 * Gets the local folders ionic configuration to override telemetry if needed
 * @param  {string} folder
 * @returns IonicConfig
 */
export function getIonicConfig(folder: string): IonicConfig {
  const config = { type: 'unknown' };
  const configFile = join(folder, 'ionic.config.json');
  if (existsSync(configFile)) {
    const json: any = readFileSync(configFile);
    const data: IonicConfig = JSON.parse(json);
    if (data.type) {
      config.type = data.type;
    } else {
      config.type = 'unknown';
      if (data.projects) {
        const keys = Object.keys(data.projects);
        if (keys.length > 0) {
          if (data.defaultProject) {
            config.type = data.projects[data.defaultProject].type;
          } else {
            // Assume the first project type
            config.type = data.projects[keys[0]].type;
          }
        }
      }
    }
  }
  return config;
}
