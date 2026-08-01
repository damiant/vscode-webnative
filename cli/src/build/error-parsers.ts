import { existsSync } from 'fs';
import { join } from 'path';
import { uncolor } from './uncolor';
import { getStringFrom } from '../project/utilities-strings';

export interface ParsedError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

interface Position {
  line: number;
  column: number;
}

interface ErrorLine {
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

export function extractErrors(output: string): ParsedError[] {
  const logs = output ? output.split('\n') : [];
  const errorText = output;
  const errors = extractErrorLines(errorText, logs);
  return errors.map(toParsedError);
}

function toParsedError(e: ErrorLine): ParsedError {
  return {
    file: e.file,
    line: e.line,
    column: e.column,
    message: e.message,
  };
}

function extractErrorLines(errorText: string, logs: string[]): ErrorLine[] {
  const errors: ErrorLine[] = [];

  if (logs.length === 0 && errorText) {
    logs = errorText.split('\n');
  }

  const isSwiftBuild = logs.some((log) => log.includes('Building xArchive'));
  if (isSwiftBuild) {
    return extractSwiftBuildErrors(logs);
  }

  if (logs.length > 0) {
    let line: string | undefined;
    let rcline: string | undefined;
    let vueline: string | undefined;
    let tsline: string | undefined;
    let javaLine: string | undefined;
    let jasmineLine: string | undefined;

    if (errorText) {
      let error: ErrorLine | undefined;
      if (errorText.startsWith('Failed to compile.')) {
        error = extractNextJSErrorFrom(errorText);
      }
      if (!error && errorText.includes('Error:')) {
        error = extractLintStyleError(errorText);
      }
      if (!error && errorText.startsWith('✘ [ERROR]')) {
        error = extractESBuildStyleError(errorText);
      }
      if (logs[0]?.startsWith('[error] Command line invocation:')) {
        logs.shift();
      }
      if (error) {
        errors.push(error);
        return errors;
      }
    }

    for (let log of logs) {
      if (log.startsWith('[capacitor]')) {
        log = log.replace('[capacitor]', '').trim();
      }

      if (log.endsWith('.ts') || log.endsWith('.tsx')) {
        line = log;
      } else {
        if (line) {
          const error = extractErrorLineFrom(log, line);
          if (error) {
            errors.push(error);
          } else {
            line = undefined;
          }
        }
      }

      if (log.startsWith('TypeScript error in ')) {
        rcline = log;
      } else {
        if (rcline) {
          errors.push(extractTypescriptErrorFrom(rcline, log.trim()));
          rcline = undefined;
        }
      }

      if (log.includes(': error ')) {
        errors.push(extractViteErrorFrom2(log));
      }
      if (log.includes('error  in ')) {
        tsline = log;
      } else {
        if (tsline) {
          if (log.trim().length > 0) {
            errors.push(extractVueTypescriptErrorFrom(tsline, log.trim()));
            tsline = undefined;
          }
        }
      }

      if (log.startsWith('SyntaxError:')) {
        errors.push(extractSyntaxError(log));
      }

      if (log.includes('error:')) {
        javaLine = log;
      } else {
        if (javaLine) {
          errors.push(extractJavaError(javaLine, log));
          javaLine = undefined;
        }
      }

      if (log.includes('Error:')) {
        jasmineLine = log;
      } else {
        if (jasmineLine) {
          if (!log.includes('<Jasmine>')) {
            errors.push(extractJasmineError(jasmineLine, log));
            jasmineLine = undefined;
          }
        }
      }

      if (log.endsWith('.vue')) {
        vueline = log;
      } else {
        if (vueline) {
          errors.push(extractVueErrorFrom(vueline, log.trim()));
          vueline = undefined;
        }
      }
    }
  }

  if (errors.length === 0 && errorText) {
    const lines = errorText.split('\n');
    let fail: string | undefined;
    let errorIn = -1;
    let failIn: string | undefined;
    for (const ln of lines) {
      if (ln.startsWith('Error: ')) {
        const parsed = extractErrorFrom(ln);
        if (parsed) errors.push(parsed);
      } else if (ln.includes('- error TS')) {
        const parsed = extractTSErrorFrom(ln);
        if (parsed) errors.push(parsed);
      } else if (ln.startsWith('FAIL')) {
        fail = ln;
      } else if (ln.startsWith('✘ [ERROR] ')) {
        errorIn = 2;
        failIn = ln.replace('✘ [ERROR] ', '').trim();
      } else {
        if (fail) {
          const parsed = extractJestErrorFrom(fail, ln);
          if (parsed) errors.push(parsed);
          fail = undefined;
        }
        if (errorIn > 0) {
          errorIn--;
          if (errorIn === 0 && failIn) {
            const parsed = extractViteErrorFrom(failIn, ln);
            if (parsed) errors.push(parsed);
            errorIn = -1;
          }
        }
      }
    }
  }
  return errors;
}

function extractESBuildStyleError(errorText: string): ErrorLine | undefined {
  try {
    const lines = errorText.split('\n');
    let error = lines[0].replace('✘ [ERROR] ', '').trim();
    if (lines[1] && lines[1].length > 1) error += ' ' + lines[1].trim();

    let fileLineIndex = -1;
    for (let i = 2; i < lines.length && i < 10; i++) {
      const trimmed = lines[i].trim();
      if (trimmed && trimmed.match(/^[^\s]+\.(ts|tsx|js|jsx|vue):\d+:\d+:?$/)) {
        fileLineIndex = i;
        break;
      }
    }

    if (fileLineIndex === -1) return undefined;

    const args = lines[fileLineIndex].trim().split(':');
    const linenumber = parseInt(args[1]) - 1;
    const column = parseInt(args[2]) - 1;
    const filename = args[0];
    return { line: linenumber, column, file: filename, message: error };
  } catch {
    return undefined;
  }
}

function extractNextJSErrorFrom(errorText: string): ErrorLine | undefined {
  try {
    const lines = uncolor(errorText).split('\n');
    const error = lines[3].replace('Error:', '').trim();
    const args = lines[4].replace('    ,-[', '').replace(']', '').split(':');
    const line = parseInt(args[1]);
    const column = parseInt(args[2]);
    return { line, column, file: args[0], message: error };
  } catch {
    return undefined;
  }
}

function extractLintStyleError(errorText: string): ErrorLine | undefined {
  try {
    const lines = errorText.split('\n');
    const filename = lines[1];
    const args = lines[2].replace('Error: ', ':').trim().split(':');
    const linenumber = parseInt(args[0]) - 1;
    const column = parseInt(args[1]) - 1;
    const error = args[2].trim();
    return { line: linenumber, column, file: filename, message: error };
  } catch {
    return undefined;
  }
}

function extractTSErrorFrom(line: string): ErrorLine | undefined {
  try {
    const codeline = line.replace('ERROR in ', '').split(':')[0];
    const args = line.split(':');
    const column = parseInt(args[2]) - 1;
    const linenumber = parseInt(args[1].trim()) - 1;
    const errormsg = line.substring(line.indexOf('- ', codeline.length) + 2);
    return {
      line: linenumber,
      column,
      file: codeline,
      message: errormsg + `line:${linenumber} pos:${column}`,
    };
  } catch {
    return undefined;
  }
}

function extractErrorFrom(line: string): ErrorLine | undefined {
  try {
    const codeline = line.replace('Error: ', '').split(':')[0];
    const args = line.split(':');
    const linenumber = parseInt(args[2]) - 1;
    const column = parseInt(args[3].substring(0, args[3].indexOf(' ')) + 2) - 1;
    const errormsg = line.substring(line.indexOf('- ', codeline.length + 7) + 2);
    return { line: linenumber, column, file: codeline, message: errormsg };
  } catch {
    return undefined;
  }
}

function extractViteErrorFrom2(txt: string): ErrorLine | undefined {
  try {
    const args = txt.split(':');
    const file = args[0].split('(')[0];
    const error = args[1] + ' ' + args[2].trim();
    const pos = getStringFrom(txt, '(', ')')?.split(',') ?? [];
    const line = parseInt(pos[0]) - 1;
    const column = parseInt(pos[1]) - 1;
    return { file, message: error, line, column };
  } catch {
    return undefined;
  }
}

function extractViteErrorFrom(fail: string, line: string): ErrorLine | undefined {
  try {
    const codeline = line.trim().split(':')[0];
    const args = line.split(':');
    const linenumber = parseInt(args[1]) - 1;
    const column = parseInt(args[2]);
    return { line: linenumber, column, file: codeline, message: fail };
  } catch {
    return undefined;
  }
}

function extractJestErrorFrom(line: string, testError: string): ErrorLine | undefined {
  try {
    const filename = line.replace('FAIL ', '').trim();
    const message = testError.replace('  ● ', '');
    return { line: 0, column: 0, file: filename, message };
  } catch {
    return undefined;
  }
}

function extractErrorLineFrom(msg: string, filename: string): ErrorLine | undefined {
  const pos = parsePosition(msg);
  const errormsg = extractErrorMessage(msg);
  if (!errormsg || errormsg.length === 0 || !msg.includes('error')) {
    return undefined;
  }
  return { message: errormsg, file: filename, line: pos.line, column: pos.column };
}

function extractJavaError(line1: string, line2: string): ErrorLine | undefined {
  try {
    const args = line1.split(' error: ');
    const filename = args[0].split(':')[0].trim();
    const linenumber = parseInt(args[0].split(':')[1]) - 1;
    return { file: filename, line: linenumber, column: 0, message: args[1].trim() + ' ' + line2.trim() };
  } catch {
    return undefined;
  }
}

function extractSwiftError(line1: string, line2: string): ErrorLine | undefined {
  try {
    const cleanLine = line1.replace(/\s*\(in target.*\)$/, '');
    const errorMatch = cleanLine.match(/:\s+(?:error|Error):\s+/i);
    if (!errorMatch) return undefined;

    const args = cleanLine.split(':');
    const filename = args[0].trim();
    const linenumber = parseInt(args[1]) - 1;
    const column = parseInt(args[2]) - 1;

    const errorIndex = cleanLine.toLowerCase().indexOf(': error:');
    const errorMessage =
      errorIndex >= 0
        ? cleanLine.substring(errorIndex + ': error:'.length).trim()
        : cleanLine.substring(cleanLine.indexOf(':') + 1).trim();

    return {
      file: filename,
      line: linenumber,
      column,
      message: errorMessage + (line2.trim() ? ' ' + line2.trim() : ''),
    };
  } catch {
    return undefined;
  }
}

function extractJasmineError(line1: string, line2: string): ErrorLine | undefined {
  try {
    let txt = line1.replace('Error: ', '');
    if (txt.length > 100) {
      txt = txt.substring(0, 80) + '...' + txt.substring(txt.length - 16, txt.length);
    }
    const place = line2.substring(line2.indexOf('(') + 1);
    const args = place.split(':');
    const filename = args[0];
    const linenumber = parseInt(args[1]) - 1;
    const column = parseInt(args[2].replace(')', '')) - 1;
    return { file: filename, line: linenumber, column, message: txt };
  } catch {
    return undefined;
  }
}

function extractErrorMessage(msg: string): string {
  try {
    const pos = parsePosition(msg);
    if (pos.line > 0 || pos.column > 0) {
      msg = msg.trim();
      msg = msg.substring(msg.indexOf('  ')).trim();
      if (msg.startsWith('error')) {
        return msg.replace('error', '').trim();
      } else if (msg.startsWith('warning')) {
        return msg.replace('warning', '').trim();
      }
    }
  } catch {
    return msg;
  }
  return msg;
}

function parsePosition(msg: string): Position {
  msg = msg.trim();
  if (msg.indexOf('  ') > -1) {
    const pos = msg.substring(0, msg.indexOf('  '));
    if (pos.indexOf(':') > -1) {
      try {
        const args = pos.split(':');
        return { line: parseInt(args[0]) - 1, column: parseInt(args[1]) - 1 };
      } catch {
        return { line: 0, column: 0 };
      }
    }
  }
  return { line: 0, column: 0 };
}

function extractTypescriptErrorFrom(msg: string, errorText: string): ErrorLine | undefined {
  try {
    msg = msg.replace('TypeScript error in ', '');
    const filename = msg.substring(0, msg.lastIndexOf('('));
    const args = msg.substring(msg.lastIndexOf('(') + 1).split(',');
    const linenumber = parseInt(args[0]);
    const column = parseInt(args[1].replace('):', ''));
    return { line: linenumber, column, message: errorText, file: filename };
  } catch {
    return undefined;
  }
}

function extractVueTypescriptErrorFrom(msg: string, errorText: string): ErrorLine | undefined {
  try {
    msg = msg.replace(' error  in ', '');
    const filename = msg.substring(0, msg.indexOf(':'));
    const args = msg.substring(msg.indexOf(':') + 1).split(':');
    const linenumber = parseInt(args[0]);
    const column = parseInt(args[1]);
    return { line: linenumber, column, message: errorText, file: filename };
  } catch {
    return undefined;
  }
}

function extractVueErrorFrom(filename: string, msg: string): ErrorLine | undefined {
  return extractErrorLineFrom(msg, filename);
}

function extractSyntaxError(msg: string): ErrorLine | undefined {
  try {
    msg = msg.replace('SyntaxError: ', '');
    const filename = msg.substring(0, msg.indexOf(':'));
    const args = msg.substring(msg.lastIndexOf('(') + 1).split(':');
    const linenumber = parseInt(args[0]);
    const column = parseInt(args[1].replace(')', ''));
    let errorText = msg.substring(msg.indexOf(':') + 1);
    errorText = errorText.substring(0, errorText.lastIndexOf('(')).trim();
    return { line: linenumber, column, message: errorText, file: filename };
  } catch {
    return undefined;
  }
}

function extractSwiftBuildErrors(logs: string[]): ErrorLine[] {
  const errors: ErrorLine[] = [];
  let swiftLine: string | undefined;
  let skipLines = 0;

  for (const log of logs) {
    if (skipLines > 0) {
      skipLines--;
      continue;
    }

    if (log.includes('.swift:') && (log.toLowerCase().includes(': error:') || log.toLowerCase().includes(': error '))) {
      swiftLine = log;
    } else {
      if (swiftLine && log.trim().length > 0 && !log.trim().startsWith('(')) {
        const extracted = extractSwiftError(swiftLine, log);
        if (extracted) {
          errors.push(extracted);
          skipLines = 2;
        }
        swiftLine = undefined;
      }
    }
  }

  return errors;
}

/** Resolve a relative file path against a project folder when the file is not absolute. */
export function resolveErrorFile(file: string | undefined, projectFolder: string): string | undefined {
  if (!file) return undefined;
  if (existsSync(file)) return file;
  const joined = join(projectFolder, file);
  if (existsSync(joined)) return joined;
  return file;
}
