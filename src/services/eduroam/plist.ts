export type PlistNode =
  | { t: 'string'; v: string }
  | { t: 'integer'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'data'; v: string }
  | { t: 'array'; v: PlistNode[] }
  | { t: 'dict'; v: Array<[string, PlistNode]> };

export const pstr = (v: string): PlistNode => ({ t: 'string', v });
export const pint = (v: number): PlistNode => ({ t: 'integer', v });
export const pbool = (v: boolean): PlistNode => ({ t: 'bool', v });
export const pdata = (base64: string): PlistNode => ({ t: 'data', v: base64 });
export const parr = (v: PlistNode[]): PlistNode => ({ t: 'array', v });
export const pdict = (v: Array<[string, PlistNode]>): PlistNode => ({ t: 'dict', v });

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function render(node: PlistNode, indent: string): string {
  switch (node.t) {
    case 'string':
      return `${indent}<string>${escapeXml(node.v)}</string>`;
    case 'integer':
      return `${indent}<integer>${node.v}</integer>`;
    case 'bool':
      return `${indent}${node.v ? '<true/>' : '<false/>'}`;
    case 'data':
      return `${indent}<data>${node.v}</data>`;
    case 'array': {
      if (node.v.length === 0) return `${indent}<array/>`;
      const inner = node.v.map((n) => render(n, indent + '\t')).join('\n');
      return `${indent}<array>\n${inner}\n${indent}</array>`;
    }
    case 'dict': {
      if (node.v.length === 0) return `${indent}<dict/>`;
      const inner = node.v
        .map(([k, n]) => `${indent}\t<key>${escapeXml(k)}</key>\n${render(n, indent + '\t')}`)
        .join('\n');
      return `${indent}<dict>\n${inner}\n${indent}</dict>`;
    }
  }
}

/** Serialize a plist node tree into a complete XML plist document. */
export function serializePlist(root: PlistNode): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    render(root, ''),
    '</plist>',
    '',
  ].join('\n');
}
