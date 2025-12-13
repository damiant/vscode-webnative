import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { write } from './logging';
import { Project } from './project';

/**
 * Updates browserslist configuration to meet specified browser requirements.
 * Works with both .browserslistrc file and browserslist in package.json
 *
 * @param project - The project instance
 * @param browsers - Array of browser requirements (e.g., ["Chrome >=107", "Firefox >=106"])
 * @returns true if any updates were made, false otherwise
 *
 * @example
 * const angular21Browsers = [
 *   "Chrome >=107",
 *   "Firefox >=106",
 *   "Edge >=107",
 *   "Safari >=16.1",
 *   "iOS >=16.1"
 * ];
 * await updateBrowserslist(project, angular21Browsers);
 */
export function updateBrowserslist(project: Project, browsers: string[]): boolean {
  const browserslistPath = join(project.projectFolder(), '.browserslistrc');
  const packageJsonPath = join(project.projectFolder(), 'package.json');

  // Create a map of browser patterns to their required versions
  const browserMap = new Map<string, string>();
  for (const browser of browsers) {
    const match = browser.match(/^([A-Za-z]+)\s*>=/);
    if (match) {
      browserMap.set(match[1], browser);
    }
  }

  // Try updating .browserslistrc first
  if (existsSync(browserslistPath)) {
    return updateBrowserslistFile(browserslistPath, browserMap);
  }

  // Fall back to updating package.json
  return updatePackageJsonBrowserslist(packageJsonPath, browserMap);
}

/**
 * Updates .browserslistrc file with new browser requirements
 */
function updateBrowserslistFile(filepath: string, browserMap: Map<string, string>): boolean {
  try {
    let content = readFileSync(filepath, 'utf8');
    let updated = false;

    // Replace existing browser entries or add new ones
    for (const [browserName, browserVersion] of browserMap) {
      const pattern = new RegExp(`^${browserName}\\s*>=\\s*[\\d.]+$`, 'm');

      if (pattern.test(content)) {
        content = content.replace(pattern, browserVersion);
        updated = true;
      } else if (!content.includes(browserVersion)) {
        // Add the browser entry if it doesn't exist
        content = content.trimEnd() + '\n' + browserVersion;
        updated = true;
      }
    }

    if (updated) {
      writeFileSync(filepath, content);
      write(`Updated ${filepath} with new browser requirements.`);
      return true;
    }
  } catch (error) {
    write(`Error updating .browserslistrc: ${error}`);
  }

  return false;
}

/**
 * Updates browserslist in package.json with new browser requirements
 */
function updatePackageJsonBrowserslist(filepath: string, browserMap: Map<string, string>): boolean {
  try {
    if (!existsSync(filepath)) {
      return false;
    }

    const packageJson = JSON.parse(readFileSync(filepath, 'utf8'));
    const currentBrowserslist = packageJson.browserslist || [];
    const newBrowserslist: string[] = [];
    const processedBrowsers = new Set<string>();

    // Update existing entries
    for (const entry of currentBrowserslist) {
      const match = entry.match(/^([A-Za-z]+)\s*>=/);
      const browserName = match ? match[1] : null;

      if (browserName && browserMap.has(browserName)) {
        const newVersion = browserMap.get(browserName)!;
        newBrowserslist.push(newVersion);
        processedBrowsers.add(browserName);
      } else {
        newBrowserslist.push(entry);
      }
    }

    // Add any missing required browsers
    for (const [browserName, browserVersion] of browserMap) {
      if (!processedBrowsers.has(browserName)) {
        newBrowserslist.push(browserVersion);
      }
    }

    packageJson.browserslist = newBrowserslist;
    writeFileSync(filepath, JSON.stringify(packageJson, null, 2) + '\n');
    write(`Updated browserslist in ${filepath} with new browser requirements.`);
    return true;
  } catch (error) {
    write(`Error updating package.json browserslist: ${error}`);
  }

  return false;
}
