import { describe, expect, it } from 'vitest';
import { parseDevice, friendlyName, getDevices } from '../src/devices/capacitor-device';

describe('capacitor device parsers', () => {
  it('parses whitespace-delimited device lines', () => {
    const line = 'iPhone 16 Pro                  iOS 18.2                  1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D';
    const device = parseDevice(line);
    expect(device).toBeDefined();
    expect(device!.id).toBe('1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D');
    expect(device!.name).toContain('iPhone 16 Pro');
  });

  it('maps Android API levels in friendly names', () => {
    expect(friendlyName('Pixel 8 API 34')).toContain('Android');
  });

  it('parses pipe-delimited cap --list output', async () => {
    const stdout = [
      'Name                          API             Target id',
      'iPhone 16 Pro                 iOS 18.2        | simulator | 1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D',
      'Damian iPhone                 iOS 18.3        | device    | 00008120-000A1B2C3D4E002E',
    ].join('\n');
    const devices = await getDevices('fake', '/tmp', async () => stdout);
    expect(devices.length).toBe(2);
    expect(devices[0].id).toBe('1B2C3D4E-5F60-4A1B-9C2D-3E4F5A6B7C8D');
    expect(devices[1].type).toBe('device');
  });
});
