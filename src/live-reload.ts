import { Project } from './project';
import { getRunOutput, openUri } from './utilities';
import { exState } from './tree-provider';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { writeError, writeWN } from './logging';
import { basename, extname, join } from 'path';
import { window } from 'vscode';
import { Server, createServer } from 'http';
import { networkInterfaces } from 'os';

export async function liveReloadSSL(project: Project): Promise<void> {
  try {
    const certFilename = getRootCACertFilename();
    // Create the Root CA and key if they dont already exist
    if (!hasRootCA()) {
      const keyFilename = await createRootCAKey();
      await createRootCA(keyFilename);
    }

    await setupServerCertificate(project);
    const url = servePage(certFilename);
    openUri(url);
  } catch (err) {
    writeError(err);
  }
}

async function setupServerCertificate(project: Project): Promise<void> {
  if (!hasRootCA()) {
    if (
      (await window.showInformationMessage(
        'A trusted root certificate is required to use HTTPS with Live Reload. Would you like to create one?',
        'Yes',
      )) == 'Yes'
    ) {
      liveReloadSSL(project);
    }
    return;
  }

  // Create a server certificate request
  const crFile = createCertificateRequest();
  const cmd = `openssl req -new -nodes -sha256 -keyout '${certPath('key')}' -config '${crFile}' -out '${certPath(
    'csr',
  )}' -newkey rsa:4096 -subj "/C=US/ST=/L=/O=/CN=myserver"`;
  writeWN(`> ${cmd}`);
  const txt = await getRunOutput(cmd, project.folder);

  // Create the server certificate
  const cmd2 = `openssl x509 -sha256 -extfile '${crFile}' -extensions x509_ext -req -in '${certPath(
    'csr',
  )}' -CA '${getRootCACertFilename()}' -CAkey '${getRootCAKeyFilename()}' -CAcreateserial -out '${certPath(
    'crt',
  )}' -days 180`;
  writeWN(`> ${cmd2}`);
  const txt2 = await getRunOutput(cmd2, project.folder);

  rmSync(crFile);

  const certFile = certPath('crt');
  if (!existsSync(certFile)) {
    writeError(`Unable to create certificate`);
  }
}

function globalPath() {
  return exState.context.globalStorageUri.fsPath;
}

export function certPath(ext: string): string {
  return join(certStorePath(), `server.${ext}`);
}

function certStorePath() {
  return exState.context.globalStorageUri.fsPath;
}

function hasRootCA() {
  const certFilename = getRootCACertFilename();
  // Create the Root CA and key if they don't already exist
  return existsSync(certFilename) && existsSync(getRootCAKeyFilename());
}

function createCertificateRequest(): string {
  const filename = join(globalPath(), 'cr.txt');
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

  // Add all external and internal IP Addresses to server certificate
  let i = 0;
  for (const address of getAddresses()) {
    i++;
    data += `IP.${i} =${address}\n`;
  }

  writeFileSync(filename, data);
  return filename;
}

async function createRootCA(keyFilename: string): Promise<string> {
  // Create the config file the Root CA
  const filename = join(globalPath(), 'cr-ca.txt');
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

  // Create the CA Certificate
  const cmd = `openssl req -config '${filename}' -key ${keyFilename} -new -x509 -days 3650 -sha256 -out ${certFName}`;
  writeWN(cmd);
  const certTxt = await getRunOutput(cmd, globalPath());
  if (!existsSync(certFilePath)) {
    writeError(certTxt);
    throw new Error('Unable to create root CA Certificate');
  }
  writeWN(`Ionic Root CA certificate created (${certFilePath})`);
  return certFilePath;
}

function getRootCAKeyFilename(): string {
  const folder = globalPath();
  if (!existsSync(folder)) {
    mkdirSync(folder);
  }
  return join(folder, 'ca.key');
}

function getRootCACertFilename(): string {
  const folder = globalPath();
  if (!existsSync(folder)) {
    mkdirSync(folder);
  }
  return join(folder, 'ca.crt');
}

async function createRootCAKey(): Promise<string> {
  const keyFilename = getRootCAKeyFilename();
  const filename = basename(keyFilename);

  if (existsSync(keyFilename)) {
    rmSync(keyFilename);
  }

  // Create the CA Key
  const cmd = `openssl genrsa -out ${filename} 4096`;
  writeWN(cmd);
  const txt = await getRunOutput(cmd, globalPath());

  if (!existsSync(keyFilename)) {
    writeError(txt);
    throw new Error('Unable to create root CA Certificate');
  }
  return filename;
}

let certServer: Server;

function servePage(certFilename: string): string {
  if (certServer) {
    certServer.close();
    certServer = undefined;
    writeWN(`Certificate Server stopped.`);
    return;
  }
  const port = 8942;
  const basePath = join(exState.context.extensionPath, 'certificates');
  certServer = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Request-Method', '*');
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    response.setHeader('Access-Control-Allow-Headers', '*');

    if (request.method == 'OPTIONS') {
      response.writeHead(200);
      response.end();
      return;
    }

    let name = request.url.includes('?') ? request.url.split('?')[0] : request.url;
    name = name == '/' ? 'index.html' : name;
    name = name == '/favicon.ico' ? '/favicon.png' : name;
    let filePath = join(basePath, name);
    if (name.endsWith('.crt')) {
      filePath = certFilename;
    }
    const ext = extname(filePath);
    const contentType = getMimeType(ext);
    const content = readFileSync(filePath);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content, 'utf-8');
  }).listen(port);

  const address = getAddress();
  const url = `http://${address}:${port}`;
  writeWN(`Server running at ${url}`);
  return url;
}

function getAddress(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
}

function getAddresses(): Array<string> {
  const result = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 addresses
      if (net.family === 'IPv4') {
        result.push(net.address);
      }
    }
  }
  return result;
}

function getMimeType(extname: string): string {
  switch (extname) {
    case '.js':
      return 'text/javascript';
    case '.css':
      return 'text/css';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
      return 'image/jpg';
    case '.wav':
      return 'audio/wav';
    case '.crt':
      return 'application/x-pem-file';
  }
  return 'text/html';
}
