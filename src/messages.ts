import { npmInstall } from './node-commands';
import { Command, Tip, TipType } from './tip';

export const error = (title: string, str: string): Tip => {
  return new Tip(title, str, TipType.Error, str, Command.NoOp, 'OK').canIgnore();
};

export const libString = (lib: string, ver: string) => {
  const vstr = ver ? ` (${ver})` : '';
  return `${lib}${vstr}`;
};

export const writeMinVersionError = (library: string, version: string, minVersion: string, reason: string): Tip => {
  return new Tip(
    library,
    `${library} must be upgraded from ${version} to at least version ${minVersion}${reason ? ' ' + reason : ''}`,
    TipType.Error,
    undefined,
    npmInstall(library + '@latest'),
    `Upgrade`,
    `${library} successfully updated.`,
  ).canIgnore();
};
export const writeMinVersionWarning = (
  library: string,
  version: string,
  minVersion: string,
  reason: string,
  url?: string,
): Tip => {
  let r = reason ? ' ' + reason : '';
  if (url) r = `[${reason}](${url})`;
  return new Tip(
    library,
    `Update to at least ${minVersion}${reason ? ' ' + reason : ''}`,
    TipType.Idea,
    `${library} ${version} should be updated to at least ${minVersion}${reason ? ' ' + reason : ''}`,
    npmInstall(`${library}@latest`),
    `Upgrade`,
    `${library} successfully updated.`,
  ).canIgnore();
};

export const writeConsistentVersionWarning = (lib1: string, ver1: string, lib2: string, ver2: string) => {
  return new Tip(
    lib2,
    `Version of ${libString(lib2, ver2)} should match ${libString(lib1, ver1)}`,
    TipType.Error,
    undefined,
    npmInstall(`${lib2}@${ver1}`),
    `Upgrade`,
    `${lib2} successfully updated.`,
  ).canIgnore();
};

export const writeConsistentVersionError = (lib1: string, ver1: string, lib2: string, ver2: string): Tip => {
  return new Tip(
    lib2,
    `Version of ${libString(lib2, ver2)} must match ${libString(lib1, ver1)}`,
    TipType.Error,
    undefined,
    npmInstall(`${lib2}@${ver1}`),
    `Upgrade`,
    `${lib2} successfully updated.`,
  ).canIgnore();
};
