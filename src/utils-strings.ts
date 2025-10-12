export function getStringFrom(data: string, start: string, end: string): string {
  if (data == undefined) return undefined;
  const foundIdx = data.lastIndexOf(start);
  if (foundIdx == -1) {
    return undefined;
  }
  const idx = foundIdx + start.length;
  const edx = data.indexOf(end, idx);
  if (edx == -1) return data.substring(idx);
  return data.substring(idx, edx);
}

export function setStringIn(data: string, start: string, end: string, replacement: string): string {
  const foundIdx = data.lastIndexOf(start);
  if (foundIdx == -1) {
    return data;
  }
  const idx = foundIdx + start.length;
  return data.substring(0, idx) + replacement + data.substring(data.indexOf(end, idx));
}

export function setAllStringIn(data: string, start: string, end: string, replacement: string): string {
  let position = 0;
  let result = data;
  let replaced = true;
  while (replaced) {
    const foundIdx = result.indexOf(start, position);
    if (foundIdx == -1) {
      replaced = false;
    } else {
      const idx = foundIdx + start.length;
      position = idx + replacement.length;
      const ndx = result.indexOf(end, idx);
      if (ndx == -1) {
        replaced = false;
      } else {
        result = result.substring(0, idx) + replacement + result.substring(ndx);
      }
    }
  }
  return result;
}

export function replaceAllStringIn(data: string, start: string, end: string, replacement: string): string {
  let position = 0;
  let result = data;
  let replaced = true;
  while (replaced) {
    const foundIdx = result.indexOf(start, position);
    if (foundIdx == -1) {
      replaced = false;
    } else {
      const idx = foundIdx;
      position = idx + replacement.length;
      result = result.substring(0, idx) + replacement + result.substring(result.indexOf(end, idx) + end.length);
    }
  }
  return result;
}

export function replaceStringIn(data: string, start: string, end: string, replacement: string): string {
  const foundIdx = data.lastIndexOf(start);
  if (foundIdx == -1) {
    return data;
  }
  const idx = foundIdx;
  return data.substring(0, idx) + replacement + data.substring(data.indexOf(end, idx) + end.length);
}

export function isEmpty(value: string): boolean {
  return value == undefined || value.trim().length == 0;
}
