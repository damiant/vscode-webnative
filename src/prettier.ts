import { Project } from './project';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ignore } from './ignore';
import { npmInstall, npmRun, saveDevArgument } from './node-commands';
import { writeError, writeIonic } from './logging';
import { ExtensionContext, window } from 'vscode';
import { Tip } from './tip';

export async function integratePrettier(project: Project) {
  try {
    const question = await window.showInformationMessage(
      'You can enforce coding standards during development using a standard set of ESLint and Prettier rules. Would you like to add this integration to your project?',
      'Yes',
      'No',
    );

    if (question != 'Yes') return;

    await project.run2(npmInstall('husky', saveDevArgument(project), '--save-exact'));
    writeIonic(`Installed husky`);
    await project.run2(npmInstall('prettier', saveDevArgument(project), '--save-exact'));
    writeIonic(`Installed prettier`);
    await project.run2(npmInstall('lint-staged', saveDevArgument(project), '--save-exact'));
    writeIonic(`Installed lint-staged`);
    const filename = join(project.projectFolder(), 'package.json');
    const packageFile = JSON.parse(readFileSync(filename, 'utf8'));

    if (!packageFile.scripts['prettify']) {
      packageFile.scripts['prettify'] = `prettier "**/*.{ts,html}" --write`;
    }

    if (!packageFile.scripts['prepare']) {
      packageFile.scripts['prepare'] = `husky install`;
    }

    if (!packageFile['husky']) {
      packageFile['husky'] = {
        hooks: {
          'pre-commit': 'npx lint-staged && npm run lint',
        },
      };
    }

    if (!packageFile['lint-staged']) {
      packageFile['lint-staged'] = {
        '*.{css,html,js,jsx,scss,ts,tsx}': ['prettier --write'],
        '*.{md,json}': ['prettier --write'],
      };
    }

    writeFileSync(filename, JSON.stringify(packageFile, undefined, 2));

    // Create a .prettierrc.json file
    const prettierrc = join(project.projectFolder(), '.prettierrc.json');
    if (!existsSync(prettierrc)) {
      writeFileSync(prettierrc, defaultPrettier());
    }

    const hasLint = !!packageFile.scripts['lint'];
    const response = await window.showInformationMessage(
      `ESLint and Prettier have been integrated and will enforce coding standards during development. Do you want to apply these standards to the code base now? (this will run '${npmRun(
        'lint -- --fix',
      )}' which may alter source code and report errors in your code)`,
      'Yes',
      'No',
    );
    if (response == 'No') {
      return;
    }
    await project.run2(npmRun('prettify'));
    if (hasLint) {
      await project.run2(npmRun('lint -- --fix'));
    }
  } catch (err) {
    writeError(`Unable to integrate prettier and ESLint:` + err);
  }
}

function defaultPrettier() {
  return JSON.stringify(
    {
      printWidth: 120, // default: 80
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true, // default: false
      quoteProps: 'as-needed',
      jsxSingleQuote: false,
      trailingComma: 'all',
      bracketSpacing: true,
      bracketSameLine: false,
      arrowParens: 'always',
      overrides: [
        {
          files: ['*.java'],
          options: {
            printWidth: 140,
            tabWidth: 4,
            useTabs: false,
            trailingComma: 'none',
          },
        },
        {
          files: '*.md',
          options: {
            parser: 'mdx',
          },
        },
      ],
    },
    undefined,
    2,
  );
}
