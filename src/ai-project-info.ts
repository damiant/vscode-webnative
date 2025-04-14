import { exists, getPackageVersion } from './analyzer';
import { Project } from './project';

export function describeProject(): string {
  if (exists('@angular/core')) {
    return `Angular ${getPackageVersion('@angular/core')} project`;
  }
  if (exists('react')) {
    return `React ${getPackageVersion('react')} project`;
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
  return 'Project';
}
