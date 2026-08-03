/** Side-effect registration of all CLI commands. */
import './info';
import './run';
import './build';
import './sync';
import './open';
import './stop';
import './devices';
import './debug';
import './scripts';
import './check';
import './packages';
import './plugins';
import './migrate';

import { registerAssetsCommand } from './assets';
import { registerConfigCommand } from './config';
import { registerGenerateCommand } from './generate';
import { registerIntegrateCommand } from './integrate';
import { registerNativeCommand } from './native';
import { registerNewCommand } from './new';
import { registerReleaseCommand } from './release';

registerNewCommand();
registerIntegrateCommand();
registerGenerateCommand();
registerConfigCommand();
registerAssetsCommand();
registerReleaseCommand();
registerNativeCommand();

export function registerAllCommands(): void {
  // Commands register via side-effect imports above.
}
