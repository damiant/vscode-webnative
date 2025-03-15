export const starterTemplates = [
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'angular-standalone',
    typeName: 'New Angular Project',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'angular',
    typeName: 'New Angular Project (Legacy)',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'angular',
    typeName: 'New Angular Project (Legacy)',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'angular',
    typeName: 'New Angular Project (Legacy)',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'angular',
    typeName: 'New Angular Project (Legacy)',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'react',
    typeName: 'New React Project',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'list',
    description: 'A starting project with a list',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'blank',
    description: 'A blank starter project',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'sidemenu',
    description: 'A starting project with a side menu with navigation in the content area',
    targets: 'ionic-targets',
  },
  {
    type: 'vue',
    typeName: 'New Vue Project',
    name: 'tabs',
    description: 'A starting project with a simple tabbed interface',
    targets: 'ionic-targets',
  },
  {
    type: 'plugin',
    typeName: 'New Capacitor Plugin',
    name: 'Starter',
    description: 'A Capacitor plugin project',
    targets: '',
  },
  {
    type: 'custom-angular',
    typeName: 'New Angular Project',
    name: 'Starter',
    description: 'A empty starter project for Angular',
    commands: ['npm install -g @angular/cli', 'ng new $(project-name)'],
    targets: '',
  },
  {
    type: 'custom-svelte',
    typeName: 'New Svelte Project',
    name: 'Starter',
    description: 'A starter project for Svelte',
    commands: ['npx sv create $(project-name) --template minimal --types ts --no-add-ons --no-install'],
  },
];

export const frameworks = [
  { name: 'Ionic Angular', icon: 'ionic', type: 'angular-standalone' },
  { name: 'Ionic React', icon: 'ionic', type: 'react' },
  { name: 'Ionic Vue', icon: 'ionic', type: 'vue' },
  { name: 'Angular', icon: 'angular', type: 'custom-angular' },
  { name: 'Svelte', icon: 'svelte', type: 'custom-svelte' },
  { name: 'Capacitor Plugin', icon: 'capacitor', type: 'plugin' },
];

export const targets = [
  {
    name: 'ionic-targets',
    targets: [
      { name: 'Web', icon: 'web', appearance: 'selected' },
      { name: 'iOS', icon: 'apple' },
      { name: 'Android', icon: 'android' },
    ],
  },
];
