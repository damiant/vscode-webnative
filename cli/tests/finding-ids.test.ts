import { describe, expect, it } from 'vitest';
import { createCollector, Finding } from '../src/rules/finding';
import { addRawFinding } from '../src/rules/factories';

describe('finding ids', () => {
  it('stores findings with stable kebab-case ids', () => {
    const c = createCollector();
    const finding: Finding = {
      id: 'capacitor-version-mismatch',
      severity: 'error',
      category: 'capacitor',
      title: '@capacitor/android major differs from @capacitor/core',
      fixable: true,
      fix: { id: 'capacitor-version-mismatch', command: 'pnpm add @capacitor/android@7.2.0' },
    };
    addRawFinding(c, finding);
    expect(c.findings).toHaveLength(1);
    expect(c.findings[0].id).toMatch(/^[a-z0-9-]+$/);
    expect(c.findings[0].fixable).toBe(true);
  });

  it('uses deprecated-plugin prefix convention', () => {
    const c = createCollector();
    addRawFinding(c, {
      id: 'deprecated-plugin-cordova-plugin-camera',
      severity: 'warning',
      category: 'packages',
      title: 'cordova-plugin-camera is deprecated',
      fixable: false,
    });
    expect(c.findings[0].id).toBe('deprecated-plugin-cordova-plugin-camera');
  });
});
