import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';
import { networkInterfaces } from 'os';
import { Project } from '../project/project';

const CERT_DIR = join(homedir(), '.config', 'wn', 'certs');

export function certStorePath(): string {
  if (!existsSync(CERT_DIR)) {
    mkdirSync(CERT_DIR, { recursive: true });
  }
  return CERT_DIR;
}

export function certPath(ext: string): string {
  return join(certStorePath(), `server.${ext}`);
}

function getRootCAKeyFilename(): string {
  return join(certStorePath(), 'ca.key');
}

function getRootCACertFilename(): string {
  return join(certStorePath(), 'ca.crt');
}

function hasRootCA(): boolean {
  return existsSync(getRootCACertFilename()) && existsSync(getRootCAKeyFilename());
}

function runCommand(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err: any) {
    const stderr = err.stderr?.toString?.() ?? '';
    const stdout = err.stdout?.toString?.() ?? '';
    throw new Error(stderr || stdout || String(err));
  }
}

export interface LiveReloadSSLOptions {
  /** When false, skip creating a root CA if missing. Default true. */
  createRootCA?: boolean;
}

export async function liveReloadSSL(project: Project, options: LiveReloadSSLOptions = {}): Promise<void> {
  const shouldCreateRootCA = options.createRootCA ?? true;
  if (!hasRootCA()) {
    if (!shouldCreateRootCA) {
      throw new Error('Root CA certificate is required for HTTPS live reload');
    }
    const keyFilename = await createRootCAKey();
    await createRootCACert(keyFilename);
  }
  await setupServerCertificate(project);
}

async function setupServerCertificate(project: Project): Promise<void> {
  if (!hasRootCA()) {
    throw new Error('Root CA certificate is required for HTTPS live reload');
  }

  const crFile = createCertificateRequest();
  const cmd = `openssl req -new -nodes -sha256 -keyout '${certPath('key')}' -config '${crFile}' -out '${certPath(
    'csr',
  )}' -newkey rsa:4096 -subj "/C=US/ST=/L=/O=/CN=myserver"`;
  runCommand(cmd, project.folder);

  const cmd2 = `openssl x509 -sha256 -extfile '${crFile}' -extensions x509_ext -req -in '${certPath(
    'csr',
  )}' -CA '${getRootCACertFilename()}' -CAkey '${getRootCAKeyFilename()}' -CAcreateserial -out '${certPath(
    'crt',
  )}' -days 180`;
  runCommand(cmd2, project.folder);

  rmSync(crFile, { force: true });

  if (!existsSync(certPath('crt'))) {
    throw new Error('Unable to create server certificate');
  }
}

function createCertificateRequest(): string {
  const filename = join(certStorePath(), 'cr.txt');
  let data = `
	[req]
	default_bits = 4096
	default_md = sha256
	distinguished_name = subject
	req_extensions = req_ext
	x509_extensions = x509_ext
	string_mask = utf8only
	prompt = no
	
	[ subject ]
	C = US
	ST = WI
	L = Madison
	O = Ionic
	OU = Development
	CN = ${getAddress()}
	
	[ x509_ext ]
	subjectKeyIdentifier = hash
	authorityKeyIdentifier = keyid,issuer
	basicConstraints = CA:FALSE
	keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
	subjectAltName = @alternate_names
	
	[ req_ext ]
	subjectKeyIdentifier = hash
	basicConstraints = CA:FALSE
	keyUsage = digitalSignature, keyEncipherment
	subjectAltName = @alternate_names
	
	[ alternate_names ]
	DNS.2 =localhost
	`;

  let i = 0;
  for (const address of getAddresses()) {
    i++;
    data += `IP.${i} =${address}\n`;
  }

  writeFileSync(filename, data);
  return filename;
}

async function createRootCACert(keyFilename: string): Promise<string> {
  const filename = join(certStorePath(), 'cr-ca.txt');
  const data = `
	[req]
	default_bits = 4096
	default_md = sha256
	distinguished_name = subject
	req_extensions = req_ext
  x509_extensions = x509_ext
	string_mask = utf8only
	prompt = no
	
	[ subject ]
	C = US
	ST = WI
	L = Madison
	O = Ionic
	OU = Development
	CN = Ionic Root CA Certificate
	
	[ req_ext ]
	basicConstraints        = critical, CA:true
	keyUsage                = critical, keyCertSign, cRLSign
	subjectKeyIdentifier    = hash
	subjectAltName          = @subject_alt_name
	authorityKeyIdentifier = keyid:always,issuer:always
	issuerAltName           = issuer:copy

	[ x509_ext ]
  subjectKeyIdentifier      = hash
  authorityKeyIdentifier    = keyid:always,issuer
  basicConstraints          = critical, CA:TRUE
  keyUsage                  = critical, digitalSignature, keyEncipherment, cRLSign, keyCertSign

	[ subject_alt_name ]
	URI                     = https://ionic.io/
	email                   = support@ionic.io	
	`;
  writeFileSync(filename, data);

  const certFilePath = getRootCACertFilename();
  const certFName = basename(certFilePath);
  if (existsSync(certFilePath)) {
    rmSync(certFilePath);
  }

  const cmd = `openssl req -config '${filename}' -key ${keyFilename} -new -x509 -days 3650 -sha256 -out ${certFName}`;
  runCommand(cmd, certStorePath());

  if (!existsSync(certFilePath)) {
    throw new Error('Unable to create root CA Certificate');
  }
  return certFilePath;
}

async function createRootCAKey(): Promise<string> {
  const keyFilename = getRootCAKeyFilename();
  const filename = basename(keyFilename);

  if (existsSync(keyFilename)) {
    rmSync(keyFilename);
  }

  const cmd = `openssl genrsa -out ${filename} 4096`;
  runCommand(cmd, certStorePath());

  if (!existsSync(keyFilename)) {
    throw new Error('Unable to create root CA key');
  }
  return filename;
}

function getAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function getAddresses(): string[] {
  const result: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4') {
        result.push(net.address);
      }
    }
  }
  return result;
}

/** Return the path to the root CA certificate for trust installation. */
export function getRootCACertPath(): string {
  return getRootCACertFilename();
}

/** Read root CA cert contents for display or installation instructions. */
export function readRootCACert(): string | undefined {
  const path = getRootCACertFilename();
  if (!existsSync(path)) return undefined;
  return readFileSync(path, 'utf8');
}
