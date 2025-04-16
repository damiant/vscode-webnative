import { exists, getPackageVersion } from './analyzer';
import { Project } from './project';

export function describeProject(): string {
  if (exists('@ionic/angular')) {
    return `Ionic Angular ${getPackageVersion('@ionic/angular')} project`;
  }
  if (exists('@ionic/react')) {
    return `Ionic React ${getPackageVersion('@ionic/react')} project`;
  }
  if (exists('@ionic/vue')) {
    return `Ionic Vue ${getPackageVersion('@ionic/vue')} project`;
  }
  if (exists('@angular/core')) {
    return `Angular ${getPackageVersion('@angular/core')} project`;
  }

  if (exists('lit')) {
    return `Lit project`;
  }

  if (exists('typescript') && exists('vite')) {
    return `Typescript web project`;
  }

  if (exists('typescript')) {
    return `Typescript ${getPackageVersion('typescript')} project`;
  }
  if (exists('vue')) {
    return `Vue ${getPackageVersion('vue')} project`;
  }

  if (exists('react')) {
    return `React ${getPackageVersion('react')} project`;
  }
  return 'Project';
}
