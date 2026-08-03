import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface IonicConfig {
  npmClient?: string;
  'git.setup'?: boolean;
  version?: string;
  type: string;
  projects?: any;
  defaultProject?: string;
}

/**
 * Gets the local folders ionic configuration to override telemetry if needed
 */
export function getIonicConfig(folder: string): IonicConfig {
  const config: IonicConfig = { type: 'unknown' };
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
            config.type = data.projects[keys[0]].type;
          }
        }
      }
    }
  }
  return config;
}
