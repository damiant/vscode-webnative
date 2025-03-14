import { window } from 'vscode';
import { clearOutput, write, writeError, writeIonic } from './logging';
import { Project } from './project';
import { getRunOutput, run, showProgress, stripJSON } from './utilities';
import { QueueFunction } from './tip';
import { getAllPackageNames } from './analyzer';

export async function audit(queueFunction: QueueFunction, project: Project): Promise<void> {
  try {
    queueFunction();
    clearOutput();
    let vulnerabilities: SecurityVulnerability[] = [];
    await showProgress('Auditing project dependencies...', async () => {
      let folder = project.projectFolder();
      if (project.monoRepo?.nodeModulesAtRoot) {
        folder = project.folder;
      }
      const data = await getRunOutput('npm audit --json', folder);
      try {
        const audit: Audit = JSON.parse(stripJSON(data, '{'));
        const dependencies = getAllPackageNames();
        vulnerabilities = analyzeAudit(dependencies, audit);
        setTimeout(async () => {
          if (vulnerabilities.length > 0) {
            await checkAuditFix(vulnerabilities, project);
          } else {
            writeIonic(`No security vulnerabilities were found using npm audit.`);
          }
        }, 1);
      } catch (error) {
        writeError('npm audit --json failed with:');
        writeError(data);
      }
    });
  } catch (error) {
    writeError(error);
  }
  return;
}

export interface SecurityVulnerability {
  name: string;
  severity: string;
  url: string;
  title: string;
}

function analyzeAudit(dependencies: string[], audit: Audit): SecurityVulnerability[] {
  const result: SecurityVulnerability[] = [];
  for (const name of Object.keys(audit.vulnerabilities)) {
    const v: Vulnerability = audit.vulnerabilities[name];

    if (dependencies.includes(name)) {
      const source = drillDown(name, audit);
      result.push({
        name,
        severity: v.severity,
        title: source ? source.title : '',
        url: source ? source.url : '',
      });
    }
  }
  return result;
}

function drillDown(name: string, audit: Audit): Source | undefined {
  for (const source of audit.vulnerabilities[name].via) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(source as any).title) {
      return drillDown(source as string, audit);
    } else {
      const src: Source = source as Source;
      return src;
    }
  }
}

async function checkAuditFix(vulnerabilities: SecurityVulnerability[], project: Project) {
  for (const vulnerability of vulnerabilities) {
    write(
      `${colorSeverity(vulnerability.severity)} ${vulnerability.severity} - ${vulnerability.name} - ${
        vulnerability.title
      } (${vulnerability.url})`,
    );
  }
  const response = await window.showWarningMessage(
    `Security vulnerabilities were found in your project. Do you want to attempt to fix them?`,
    'Yes',
    'Cancel',
  );
  if (response === 'Yes') {
    clearOutput();
    write('> npm audit fix');
    await run(project.projectFolder(), 'npm audit fix', undefined, [], [], undefined, undefined, undefined, false);
  }
}

async function completeAudit(project: Project, audit: Audit) {
  const severities = ['critical', 'high', 'moderate', 'low'];
  const types = ['direct', 'indirect'];
  writeIonic(
    `There are ${audit.metadata.vulnerabilities.total} security vulnerabilities in your projects ${audit.metadata.dependencies.total} dependencies`,
  );
  for (const type of types) {
    if (type == 'indirect' && audit.metadata.vulnerabilities.total > 0) {
      write('');
      write('Other vulnerable dependencies');
    }
    for (const severity of severities) {
      for (const name of Object.keys(audit.vulnerabilities)) {
        const v: Vulnerability = audit.vulnerabilities[name];
        if (v.severity == severity) {
          let direct = false;
          for (const source of v.via) {
            if (typeof source === 'object') direct = true;
            if (type == 'direct' && typeof source === 'object') {
              write(`[${v.severity}] ${source.title} ${source.url}`);
            }
          }
          if (!direct && type === 'indirect') {
            write(`${v.name} is vulnerable because it uses ${v.via.join(',')}`);
          }
        }
      }
    }
  }

  if (audit.metadata.vulnerabilities.total > 0) {
    const response = await window.showWarningMessage(
      `${audit.metadata.vulnerabilities.total} security vulnerabilities were found in your project. Do you want to attempt to fix them?`,
      'Yes',
      'Cancel',
    );
    if (response === 'Yes') {
      clearOutput();
      write('> npm audit fix');
      await run(project.projectFolder(), 'npm audit fix', undefined, [], [], undefined, undefined, undefined, false);
    }
  }
}

function colorSeverity(severity: string | undefined): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'moderate':
      return '🟡';
    case 'low':
      return '⚪';
    default:
      return '-';
  }
}

interface Vulnerability {
  name: string;
  severity: string;
  isDirect: boolean;
  via: Source[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean;
}

interface Source {
  source: number;
  name: string;
  dependency: string;
  title: string;
  url: string;
  severity: string;
  cwe: string[];
  cvss: Cvss;
  range: string;
}

interface Cvss {
  score: number;
  vectorString: string;
}

interface Audit {
  auditReportVersion: number;
  vulnerabilities: object;
  metadata: AuditMetadata;
}

interface AuditMetadata {
  vulnerabilities: VulnerabilitiesMeta;
  dependencies: DependenciesMeta;
}

interface VulnerabilitiesMeta {
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

interface DependenciesMeta {
  prod: number;
  dev: number;
  optional: number;
  peer: number;
  peerOptional: number;
  total: number;
}
