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
