import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';

import { MessageType, sendMessage } from './utilities/messages';
import { Template } from './utilities/template';
import { getValue } from './utilities/dom';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

interface Framework {
  name: string;
  icon: string;
  appearance: string;
  type: string;
  targets: string; // Name of a TargetSet
}

interface TargetSet {
  name: string;
  targets: Target[];
}

interface Target {
  name: string;
  icon: string;
  appearance: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports: [BrowserModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent implements OnInit {
  private templates: Template[] = [];
  frameworks: Framework[] = [];
  targetSets: TargetSet[] = []; // All the target sets
  targets: Target[] = []; // The targets of the selected framework
  projectName = '';
  frameworkTemplates: Template[] = [];
  assetsUri = '';
  creating = false;
  ready = false;
  nameError = false;
  projectsFolder = '';
  projectFolder = '';

  async ngOnInit() {
    window.addEventListener('message', this.onMessage.bind(this));
    sendMessage(MessageType.getTemplates, '');
    sendMessage(MessageType.getProjectsFolder, '');
    setInterval(() => {
      let name = getValue('projectName');
      name = name.toLocaleLowerCase().replace(/ /g, '-');
      this.projectFolder = name.replace(/[^a-zA-Z0-9- ]/g, '');
    }, 1000);
  }

  public slash(): string {
    return navigator.platform && navigator.platform.toLowerCase().includes('mac') ? `/` : `\\`;
  }

  public select(framework: Framework) {
    if (framework.type === 'plugin' && this.projectName.trim() === '') {
      this.projectName = 'capacitor-';
      document.getElementById('projectName')?.focus();
    }
    for (const f of this.frameworks) {
      f.appearance = 'unselected';
    }
    framework.appearance = 'selected';
    this.frameworkTemplates = this.templates.filter((template) => template.type == framework.type);
    for (const f of this.frameworkTemplates) {
      f.appearance = 'unselected';
    }
    this.selectTemplate(this.frameworkTemplates[0]);
    //    this.frameworkTemplates[0].appearance = 'selected';
  }

  public selectTarget(target: Target) {
    if (target.name == 'Web') return; // Cant turn off web
    target.appearance = target.appearance == 'selected' ? 'unselected' : 'selected';
  }

  public selectTemplate(template: Template) {
    for (const t of this.frameworkTemplates) {
      t.appearance = 'unselected';
    }
    template.appearance = template.appearance == 'selected' ? 'unselected' : 'selected';
    const targetSet = this.targetSets.find((t) => t.name === template.targets);
    this.targets = targetSet ? targetSet.targets : [];
  }

  public create() {
    const name = getValue('projectName').trim();
    if (!name || name.length < 2 || name.endsWith('-') || name.endsWith('.')) {
      document.getElementById('projectName')?.focus();
      this.nameError = true;
      setTimeout(() => {
        this.nameError = false;
      }, 3000);
      return;
    }
    const targets: string[] = [];
    if (this.targets) {
      this.targets.map((target) => {
        if (target.appearance == 'selected') {
          targets.push(target.name.toLowerCase());
        }
      });

      const template = this.selectedTemplate();
      if (!template) {
        return;
      }
      const project = { type: template.type, template: template.name, name, targets };
      sendMessage(MessageType.createProject, JSON.stringify(project));
    } else {
      const project = { type: 'plugin', template: name, name, targets };
      sendMessage(MessageType.createProject, JSON.stringify(project));
    }
  }

  public chooseFolder() {
    sendMessage(MessageType.chooseFolder, '');
  }

  private selectedTemplate(): Template | undefined {
    for (const t of this.frameworkTemplates) {
      if (t.appearance == 'selected') {
        return t;
      }
    }
    return undefined;
  }

  async onMessage(event: any) {
    switch (event.data.command) {
      case MessageType.getTemplates:
        this.setup(event.data.templates, event.data.assetsUri, event.data.frameworks, event.data.targets);
        break;
      case MessageType.getProjectsFolder:
        this.projectsFolder = event.data.folder;
        break;
      case MessageType.chooseFolder:
        this.projectsFolder = event.data.folder;
        break;
      case MessageType.creatingProject:
        this.creating = true;
        break;
      default:
        console.log(event.data.command);
    }
  }

  setup(templates: Template[], assetsUri: string, frameworks: Framework[], targetSet: TargetSet[]) {
    this.assetsUri = assetsUri;
    for (const template of templates) {
      template.title = this.titleCase(template.name);
      template.appearance = 'unselected';
      template.icon = this.templateIcon(template.name);
    }
    templates.sort((a, b) => (a.name > b.name ? 1 : -1));
    this.templates = templates;
    frameworks.map((f) => (f.appearance = 'unselected'));
    this.frameworks = frameworks;
    this.targetSets = targetSet;
    this.ready = true;
  }

  private templateIcon(name: string): string {
    switch (name.toLowerCase()) {
      case 'list':
        return 'list';
      case 'blank':
        return 'blank';
      case 'sidemenu':
        return 'sidemenu';
      case 'my-first-app':
        return 'my-first-app';
      case 'tabs':
        return 'tabs';
      default:
        return 'blank';
    }
  }

  private titleCase(str: string) {
    const tmp = str.toLowerCase().split('-');
    for (let i = 0; i < tmp.length; i++) {
      tmp[i] = tmp[i].charAt(0).toUpperCase() + tmp[i].slice(1);
    }
    return tmp.join(' ');
  }
}
