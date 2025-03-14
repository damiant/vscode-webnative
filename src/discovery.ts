import * as dgram from 'dgram';
import * as events from 'events';

import { Netmask } from 'netmask';
import { hostname, networkInterfaces } from 'os';

const PREFIX = 'ION_DP';
const PORT = 41234;

export interface Interface {
  address: string;
  broadcast: string;
}

export interface IPublisher {
  emit(event: 'error', err: Error): boolean;
  on(event: 'error', listener: (err: Error) => void): this;
}

export class Publisher extends events.EventEmitter implements IPublisher {
  id: string;
  path = '/';
  running = false;
  interval = 2000;

  timer?: any;
  client?: dgram.Socket;
  interfaces?: Interface[];

  constructor(
    public namespace: string,
    public name: string,
    public port: number,
    public secure: boolean,
  ) {
    super();

    if (name.indexOf(':') >= 0) {
      console.warn('name should not contain ":"');
      name = name.replace(':', ' ');
    }

    this.id = String(Math.round(Math.random() * 1000000));
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.running) {
        return resolve();
      }

      this.running = true;

      if (!this.interfaces) {
        this.interfaces = this.getInterfaces();
      }

      const client = (this.client = dgram.createSocket('udp4'));

      client.on('error', (err) => {
        this.emit('error', err);
      });

      client.on('listening', () => {
        client.setBroadcast(true);
        this.timer = setInterval(this.sayHello.bind(this), this.interval);
        this.sayHello();
        resolve();
      });

      client.bind();
    });
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    if (this.client) {
      this.client.close();
      this.client = undefined;
    }
  }

  buildMessage(ip: string): string {
    const now = Date.now();
    const message = {
      t: now,
      id: this.id,
      nspace: this.namespace,
      name: this.name,
      host: hostname(),
      ip: ip,
      port: this.port,
      path: this.path,
      secure: this.secure,
    };
    return PREFIX + JSON.stringify(message);
  }

  getInterfaces(): Interface[] {
    return prepareInterfaces(networkInterfaces());
  }

  private sayHello() {
    if (!this.interfaces) {
      throw new Error('No network interfaces set--was the service started?');
    }

    try {
      for (const iface of this.interfaces) {
        const message = new Buffer(this.buildMessage(iface.address));

        this.client!.send(message, 0, message.length, PORT, iface.broadcast, (err) => {
          if (err) {
            this.emit('error', err);
          }
        });
      }
    } catch (e) {
      this.emit('error', e);
    }
  }
}

export function prepareInterfaces(interfaces: any): Interface[] {
  const set = new Set<string>();
  return Object.keys(interfaces)
    .map((key) => interfaces[key] as any[])
    .reduce((prev, current) => prev.concat(current))
    .filter((iface) => iface.family === 'IPv4')
    .map((iface) => {
      return {
        address: iface.address,
        broadcast: computeBroadcastAddress(iface.address, iface.netmask),
      };
    })
    .filter((iface) => {
      if (!set.has(iface.broadcast)) {
        set.add(iface.broadcast);
        return true;
      }
      return false;
    });
}

export function newSilentPublisher(namespace: string, name: string, port: number, secure: boolean): Publisher {
  name = `${name}@${port}`;
  const service = new Publisher(namespace, name, port, secure);
  service.on('error', (error) => {
    console.log(error);
  });
  service.start().catch((error) => {
    console.log(error);
  });
  return service;
}

export function computeBroadcastAddress(address: string, netmask: string): string {
  const ip = address + '/' + netmask;
  const block = new Netmask(ip);
  return block.broadcast;
}
