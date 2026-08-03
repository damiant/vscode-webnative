import { stripJsonPrefix } from '../commands/helpers';

export interface SecurityVulnerability {
  name: string;
  severity: string;
  url: string;
  title: string;
}

export interface AuditResult {
  vulnerabilities: SecurityVulnerability[];
  metadata?: AuditMetadata;
  raw?: Audit;
}

interface Source {
  title: string;
  url: string;
}

interface Vulnerability {
  severity: string;
  via: Array<Source | string>;
}

interface Audit {
  vulnerabilities: Record<string, Vulnerability>;
  metadata: AuditMetadata;
}

interface AuditMetadata {
  vulnerabilities: { total: number; critical: number; high: number; moderate: number; low: number };
  dependencies: { total: number };
}

export function parseAuditOutput(data: string, dependencies: string[]): AuditResult {
  try {
    const audit: Audit = JSON.parse(stripJsonPrefix(data, '{'));
    return {
      vulnerabilities: analyzeAudit(dependencies, audit),
      metadata: audit.metadata,
      raw: audit,
    };
  } catch {
    throw new Error('npm audit --json returned invalid output');
  }
}

function analyzeAudit(dependencies: string[], audit: Audit): SecurityVulnerability[] {
  const result: SecurityVulnerability[] = [];
  for (const name of Object.keys(audit.vulnerabilities ?? {})) {
    const v = audit.vulnerabilities[name];
    if (!dependencies.includes(name)) continue;
    const source = drillDown(name, audit);
    result.push({
      name,
      severity: v.severity,
      title: source?.title ?? '',
      url: source?.url ?? '',
    });
  }
  return result;
}

function drillDown(name: string, audit: Audit): Source | undefined {
  for (const source of audit.vulnerabilities[name].via) {
    if (typeof source === 'string') {
      const nested = drillDown(source, audit);
      if (nested) return nested;
    } else {
      return source;
    }
  }
  return undefined;
}

export function filterBySeverity(vulnerabilities: SecurityVulnerability[], severity?: string): SecurityVulnerability[] {
  if (!severity) return vulnerabilities;
  const order = ['low', 'moderate', 'high', 'critical'];
  const minIdx = order.indexOf(severity.toLowerCase());
  if (minIdx === -1) return vulnerabilities;
  return vulnerabilities.filter((v) => order.indexOf(v.severity) >= minIdx);
}
