import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, OnInit, signal } from '@angular/core';

import { MessageType, sendMessage } from './utilities/messages';
import { Template } from './utilities/template';
import { getValue } from './utilities/dom';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { vscode } from './utilities/vscode';
import { Location } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [BrowserModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  spinner = true;
  location = inject(Location);
  baseUrl = '';
  assetsUri = '';
  mobileClass = signal('');
  webClass = signal('');
  id = '';

  async ngOnInit() {
    window.addEventListener('message', this.onMessage.bind(this));
  }

  public slash(): string {
    return navigator.platform && navigator.platform.toLowerCase().includes('mac') ? `/` : `\\`;
  }

  change() {
    vscode.postMessage({ id: `${this.id}`, url: (document as any).getElementById('frame').src });
  }

  back() {
    this.location.back();
  }

  reload() {
    const f: any = document.getElementById('frame');
    f.src = f.src;
  }

  set(command: string) {
    if (command == 'back') {
      this.location.back();
      return;
    }
    vscode.postMessage({ command, id: this.id });
  }

  async onMessage(event: any) {
    console.log('editor message', event.data);
    if (event.data.command == 'stopSpinner') {
      this.spinner = false;
      return;
    }
    function e(name: string): any {
      return document.getElementById(name);
    }

    if (event.data.command !== 'device') return;
    const device = event.data.device;
    this.baseUrl = event.data.baseUrl ?? this.baseUrl;
    this.assetsUri = event.data.assetsUri ?? this.assetsUri;
    this.id = event.data.id ?? this.id;

    this.mobileClass.set(device.type == 'mobile' ? 'selected' : '');
    this.webClass.set(device.type == 'web' ? 'selected' : '');

    let newurl = this.baseUrl;
    let width = device.width + 'px';
    let dHeight = device.height + 50 + 'px';
    let height = device.height + 'px';
    let devFrameDisplay = 'block';
    let bodyMarginTop = '0';
    let bodyDisplay = 'flex';
    let devFrameAspectRatio = 'unset';
    let webWidth = '100%';
    let webHeight = '0';
    let webSrc = 'about:blank';
    let frameSrc = 'about:blank';
    let webDisplay = 'none';
    let framePadding = 50; // Height in pixels of padding from toolbar and mobile frame
    if (device.type == 'ios') {
      newurl += '?ionic:mode=ios';
    }
    if (device.type == 'web') {
      width = '100%';
      dHeight = '100%';
      height = '100%';
      devFrameDisplay = 'none';
      webDisplay = 'block';
      webSrc = newurl;
      webHeight = '100%';
    } else {
      if (device.type == 'mobile') {
        width = 'unset';
        height = '100%';
        dHeight = '100%';
        framePadding = 80;
        devFrameAspectRatio = '2/3.6';
      }
      frameSrc = newurl;

      webWidth = '0';
      bodyMarginTop = '20px';
    }
    e('frame').src = frameSrc;
    e('web').src = webSrc;
    e('web').width = webWidth;
    e('web').height = webHeight;
    e('web').style.display = webDisplay;
    e('body').style.display = bodyDisplay;

    e('body').style.height = `${window.innerHeight - framePadding}px`;
    e('body').style.marginTop = bodyMarginTop;
    e('devFrame').style.aspectRatio = devFrameAspectRatio;
    e('devFrame').style.display = devFrameDisplay;
    e('devFrame').style.width = width;
    e('devFrame').style.height = dHeight;
  }
}
