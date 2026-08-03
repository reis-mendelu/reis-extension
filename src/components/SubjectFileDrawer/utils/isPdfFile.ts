/** IS does not always report a type, so the extension is the fallback signal. */
export function isPdfFile(subFile: { link: string; type: string }): boolean {
  return subFile.type === 'pdf' || subFile.link.toLowerCase().endsWith('.pdf');
}
