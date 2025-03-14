import { PackageInfo } from './package-info';
import { generateUUID } from './utilities';
import { Project } from './project';
import { PackageType } from './npm-model';
import { writeWarning } from './logging';
import { ExtensionContext } from 'vscode';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { request } from 'http';
import { homedir, platform, release } from 'os';
import { workspace } from 'vscode';

interface TelemetryMetric {
  name: string;
  timestamp: string;
  session_id: string;
  source: string;
  value: any;
}

interface TelemetryEvent {
  metrics: Array<TelemetryMetric>;
  sent_at: string;
}

export enum TelemetryEventType {
  Packages = 'VS Code Extension Packages',
  Usage = 'VS Code Extension Usage',
  Login = 'VS Code Extension Login',
  SignUp = 'VS Code Extension Sign Up',
}

export interface IonicConfig {
  telemetry: boolean;
  npmClient?: string;
  'git.setup'?: boolean;
  'tokens.telemetry'?: string;
  'user.email'?: string;
  'user.id'?: string;
  version?: string;
  type: string; // ionic.config.json type
  sessionId: string; // Generated
  projects?: any;
  defaultProject?: string;
}

export function sendTelemetryEvent(folder: string, name: string, context: ExtensionContext) {
  const config = getIonicConfig(folder);
  if (!config.telemetry) return;
  sendTelemetry(config.telemetry, config.sessionId, name, {
    extension: context.extension.packageJSON.version,
  });
}

export function sendTelemetryEvents(folder: string, project: Project, packages: any, context: ExtensionContext) {
  const config = getIonicConfig(folder);
  if (!config.telemetry) return;

  try {
    const sent = context.workspaceState.get(`packages-${project.name}`);
    if (sent != project.modified?.toUTCString()) {
      const packageList = [];
      const packageVersions = [];
      const plugins = [];
      if (packages != undefined) {
        for (const library of Object.keys(packages)) {
          const info: PackageInfo = packages[library];
          packageVersions.push(`${library}@${info.version}`);
          packageList.push(library);
          if (info.depType == PackageType.CordovaPlugin || info.depType == PackageType.CapacitorPlugin) {
            plugins.push(library);
          }
        }
        sendTelemetry(config.telemetry, config.sessionId, TelemetryEventType.Packages, {
          extension: context.extension.packageJSON.version,
          name: project.name,
          projectType: project.type,
          packages: packageList,
          packageVersions: packageVersions,
          plugins: plugins,
        });
      }

      // Store the last time the package.json was modified so that we can send if it changes
      context.workspaceState.update(`packages-${project.name}`, project.modified?.toUTCString());
    }

    const sentUsage = context.globalState.get(`lastusage`);
    if (!sentUsage || new Date().toLocaleDateString() !== sentUsage) {
      sendTelemetry(config.telemetry, config.sessionId, TelemetryEventType.Usage, {
        extension: context.extension.packageJSON.version,
      });

      // Store the last time the extension was used so we can report it daily
      context.globalState.update(`lastusage`, new Date().toLocaleDateString());
    }
  } catch (err) {
    writeWarning(err);
  }
}

/**
 * Sends telemetry to Ionic
 * @param  {boolean} telemetry If false will not send
 * @param  {string} sessionId A session identifier
 * @param  {string} event_type Name of the event to send
 * @param  {any} payload Javascript object containing information to send
 */
function sendTelemetry(telemetry: boolean, sessionId: string, event_type: string, payload: any) {
  if (!telemetry) return;

  try {
    payload.event_type = event_type;
    payload.os_name = platform();
    payload.os_version = release();

    // Call POST https://api.ionicjs.com/events/metrics
    const now = new Date().toISOString();
    const metric: TelemetryMetric = {
      name: 'vscode_ext',
      timestamp: now,
      session_id: sessionId,
      source: 'vscode_ext',
      value: payload,
    };
    const event: TelemetryEvent = {
      metrics: [metric],
      sent_at: now,
    };

    const data = JSON.stringify(event);
    const options = {
      hostname: 'api.ionicjs.com',
      port: 443,
      path: '/events/metrics',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = request(options, (res) => {
      res.on('data', (d) => {
        console.log(d.toString());
      });
    });

    req.on('error', (error) => {
      console.error(error);
    });
    req.write(data);
    req.end();
  } catch (err) {
    console.error('Unable to send telemetry', err);
  }
}
/**
 * Gets the local folders ionic configuration to override telemetry if needed
 * @param  {string} folder
 * @returns IonicConfig
 */
export function getIonicConfig(folder: string): IonicConfig {
  const config = getGlobalIonicConfig();
  const configFile = join(folder, 'ionic.config.json');
  if (existsSync(configFile)) {
    const json: any = readFileSync(configFile);
    const data: IonicConfig = JSON.parse(json);
    if (data.telemetry) {
      config.telemetry = data.telemetry; // Override global with local setting
    }
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
  config.sessionId = config['tokens.telemetry'];
  if (!config.sessionId) {
    config.sessionId = generateUUID();
  }
  return config;
}

/**
 * Look for ~/.ionic/config.json and return json object or default
 * @returns IonicConfig
 */
export function getGlobalIonicConfig(): IonicConfig {
  const configPath = resolve(homedir(), '.ionic');
  const configFile = join(configPath, 'config.json');

  if (existsSync(configFile)) {
    const json: any = readFileSync(configFile);
    const data: IonicConfig = JSON.parse(json);
    if (!data.telemetry) {
      data.telemetry = true; // Default is true for telemetry
    }
    return data;
  } else {
    const ignoreIonicCLI: boolean = workspace.getConfiguration('ionic').get('ignoreIonicCLIConfig');
    return { telemetry: !ignoreIonicCLI, sessionId: generateUUID(), type: 'unknown' };
  }
}

/** INFO about telemtry
you can collect analytics/metrics/telemetry by posting an EventsSchema to https://api.ionicjs.com/events/metrics
the EventsSchema is defined here: https://github.com/ionic-team/appflow-core/blob/main/ionic_api_core/schema/schemas.py#L12-L24
the the CLI implementations are here: https://github.com/ionic-team/ionic-cli/blob/develop/packages/@ionic/cli/src/lib/telemetry.ts
https://github.com/ionic-team/capacitor/blob/main/cli/src/tasks/telemetry.ts
https://github.com/ionic-team/stencil/blob/main/src/cli/telemetry/telemetry.ts
the stencil CLI does something similar to collect a list of ionic (the company) packages: https://github.com/ionic-team/stencil/blob/main/src/cli/telemetry/telemetry.ts#L149-L192
{
  "metrics": [
    {
    "name": "vscode_ext",
    "session_id": "7257a836-8b5c-4250-844d-c9f01f0a0949",
    "source": "vscode_ext",
    "timestamp": "2022-02-24T19:56:56.773Z",
    "value": {
      "event_type": "actual_event_name",
      "os_name": "darwin",
      "os_version": "21.3.0",
  
      "arguments": ["--dev", "--watch", "--serve", "start"],
      "build": "20220124181123",
      "cpu_model": "Intel(R) Core(TM) i7-4770HQ CPU @ 2.20GHz",
      "duration_ms": 56202,
      "has_app_pwa_config": false,
      "packages": ["@stencil/core@2.6.0", "@stencil/sass@1.4.1"],
      "packages_no_versions": ["@stencil/core", "@stencil/sass"],
      "rollup": "2.42.3",
      "stencil": "2.13.0",
      "system": "node 15.14.0",
      "system_major": "node 15",
      "targets": ["dist-custom-elements-bundle", "www", "dist-lazy", "copy", "dist-global-styles", "dist", "dist-types", "docs-readme", "angular"],
      "task": "build",
      "typescript": "4.3.5",
      "yarn": true
    }   
    }     
  ],    
  "sent_at": "2022-02-24T19:56:56.773Z"
  }  
*/
