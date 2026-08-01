export type Severity = 'error' | 'warning' | 'info';
export type Category =
  | 'packages'
  | 'capacitor'
  | 'cordova'
  | 'angular'
  | 'typescript'
  | 'android'
  | 'ios'
  | 'browserslist'
  | 'security'
  | 'privacy';

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  detail?: string;
  url?: string;
  fixable: boolean;
  fix?: { id: string; command?: string | string[] };
}

export type FindingCollector = { add(f: Finding): void; findings: Finding[] };

export function createCollector(): FindingCollector {
  const findings: Finding[] = [];
  return {
    findings,
    add(f: Finding) {
      findings.push(f);
    },
  };
}
