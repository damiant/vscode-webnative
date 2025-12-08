/**
 * MCP Tools for device management (list, run)
 */

import { z } from 'zod';

import { npxCommand } from '../shared/node-commands.js';
import { runCommand, runCommandStreaming } from '../shared/process.js';
import { Project } from '../shared/project.js';

interface Device {
  id: string;
  name: string;
  type: 'device' | 'emulator';
}

export const listDevicesSchema = z.object({
  platform: z.enum(['ios', 'android']).describe('Platform to list devices for'),
  projectPath: z.string().describe('Path to the project folder'),
});

export const runOnDeviceSchema = z.object({
  deviceId: z.string().optional().describe('Specific device ID to run on (leave empty to prompt)'),
  liveReload: z.boolean().optional().describe('Enable live reload during development'),
  platform: z.enum(['ios', 'android']).describe('Platform to run on'),
  projectPath: z.string().describe('Path to the project folder'),
});

/**
 * List available iOS or Android devices for running the app
 */
export async function listDevices(args: z.infer<typeof listDevicesSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    const command = `${npxCommand(project)} cap run ${args.platform} --list`;
    const result = await runCommand(command, {
      cwd: project.projectFolder(),
      timeout: 30000,
    });

    if (!result.success) {
      return JSON.stringify(
        {
          devices: [],
          message: 'Failed to list devices',
          platform: args.platform,
          success: false,
        },
        null,
        2,
      );
    }

    const devices = parseDeviceList(result.output, args.platform);

    return JSON.stringify(
      {
        data: {
          devices,
          platform: args.platform,
          projectPath: args.projectPath,
        },
        message: `Found ${devices.length} ${args.platform} device(s)`,
        success: true,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to list devices',
        success: false,
      },
      null,
      2,
    );
  }
}

/**
 * Build and run the app on a connected iOS or Android device
 */
export async function runOnDevice(args: z.infer<typeof runOnDeviceSchema>) {
  try {
    const project = new Project(args.projectPath);
    await project.load();

    let command = `${npxCommand(project)} cap run ${args.platform}`;

    if (args.deviceId) {
      command += ` --target="${args.deviceId}"`;
    }

    if (args.liveReload) {
      command += ' --live-reload';
    }

    const logs: string[] = [];

    const result = await runCommandStreaming(
      command,
      {
        cwd: project.projectFolder(),
        timeout: 300000, // 5 minutes for build + deploy
      },
      (line: string) => {
        // Collect logs as they stream in
        logs.push(line);
      },
    );

    return JSON.stringify(
      {
        command,
        data: {
          deviceId: args.deviceId,
          liveReload: args.liveReload,
          logs: logs,
          output: result.output,
          platform: args.platform,
          projectPath: args.projectPath,
        },
        message: result.success
          ? `App running on ${args.platform}${args.deviceId ? ` device ${args.deviceId}` : ''}`
          : `Failed to run on ${args.platform}`,
        success: result.success,
      },
      null,
      2,
    );
  } catch (err) {
    const error = err as Error;
    return JSON.stringify(
      {
        error: error.message,
        message: 'Failed to run on device',
        success: false,
      },
      null,
      2,
    );
  }
}

// Helper functions

function formatDeviceName(name: string, platform: string): string {
  let formatted = name;

  // Remove platform-specific suffixes
  if (platform === 'android') {
    formatted = formatted.replace(' (emulator)', '').replace(' (device)', '');
  } else if (platform === 'ios') {
    formatted = formatted.replace(' (simulator)', '').replace(' (device)', '');
  }

  return formatted;
}

function parseDeviceList(output: string, platform: string): Device[] {
  const devices: Device[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Android format: "emulator-5554 (emulator)" or "ABC123 (device)"
    // iOS format: "iPhone 14 Pro (12345678-ABCD-...) (simulator)"
    const androidMatch = line.match(/^(\S+)\s+\((emulator|device)\)/);
    const iosMatch = line.match(/^(.+?)\s+\(([A-F0-9-]+)\)\s+\((simulator|device)\)/);

    if (platform === 'android' && androidMatch) {
      devices.push({
        id: androidMatch[1],
        name: formatDeviceName(line, platform),
        type: androidMatch[2] === 'emulator' ? 'emulator' : 'device',
      });
    } else if (platform === 'ios' && iosMatch) {
      devices.push({
        id: iosMatch[2],
        name: formatDeviceName(iosMatch[1], platform),
        type: iosMatch[3] === 'simulator' ? 'emulator' : 'device',
      });
    }
  }

  return devices;
}
