import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/storage/IndexedDBService', () => ({
    IndexedDBService: {}
}));

import { parsePastSubjectTree } from '../pastSubjects';

const FIXTURE = `
<div class="subtree"><ul>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=6;lang=cz">Předměty minulých období</a>
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=10400;lang=cz">PEF</a>
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=151957;lang=cz">ZS 2025/2026</a>
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=150953;lang=cz">EBC-ALG Algoritmizace</a>&nbsp;(24)
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=150954;lang=cz">EBC-AP Architektura počítačů</a>&nbsp;(21)
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=150180;lang=cz"><b>EBC-KOM Komunikace</b></a>&nbsp;(<b>2</b>/12)
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=150955;lang=cz">EBC-TZI Teoretické základy informatiky</a>
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=152415;lang=cz">EBC-TZI / Informace k&nbsp;výuce</a>&nbsp;(1)
  </div></div></li>
  <li><div class="node-container"><div class="node-label">
    <a href="slozka.pl?;id=152416;lang=cz">EBC-TZI / Materiály z&nbsp;přednášek</a>&nbsp;(10)
  </div></div></li>
</ul></div>
`;

describe('parsePastSubjectTree', () => {
    it('extracts subject-level folders, ignoring container/subfolder nodes', () => {
        const result = parsePastSubjectTree(FIXTURE);

        expect(Object.keys(result).sort()).toEqual([
            'EBC-ALG', 'EBC-AP', 'EBC-KOM', 'EBC-TZI',
        ]);

        expect(result['EBC-ALG']).toEqual({
            subjectCode: 'EBC-ALG',
            displayName: 'Algoritmizace',
            folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=150953',
        });

        expect(result['EBC-KOM']).toEqual({
            subjectCode: 'EBC-KOM',
            displayName: 'Komunikace',
            folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=150180',
        });
    });

    it('returns empty object for empty or malformed HTML', () => {
        expect(parsePastSubjectTree('')).toEqual({});
        expect(parsePastSubjectTree('<div>no links</div>')).toEqual({});
    });

    it('skips subfolder nodes with " / " in the label', () => {
        const result = parsePastSubjectTree(FIXTURE);
        expect(result).not.toHaveProperty('EBC-TZI / Informace k výuce');
    });
});
