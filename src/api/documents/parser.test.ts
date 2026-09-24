import { describe, it, expect } from 'vitest';
import { parseServerFiles } from './parser';

describe('parseServerFiles - Link Filtering', () => {
  it('should ignore teacher profile and document info links, resolving only download links', () => {
    const html = `
            <table id="tmtab_1">
                <thead>
                    <tr class="zahlavi">
                        <th></th>
                        <th>Ozn.</th>
                        <th>Název</th>
                        <th>Vložil</th>
                        <th>Datum dokumentu</th>
                        <th></th>
                    </tr>
                </thead>
                <tr class="uis-hl-table lbn">
                    <td class="UISTMNumberCell">1</td>
                    <td>
                        <!-- Subfolder column -->
                        Ostatní
                    </td>
                    <td>
                         <!-- File Name column -->
                         <b>Přednáška 92 -- abstraktní datové typy moduly</b>
                    </td>
                    <td>
                         <!-- Author/Teacher cell with unwanted link -->
                         <a href="/auth/lide/clovek.pl?id=1728;lang=cz">doc. Ing. Oldřich Trenz, Ph.D.</a>
                    </td>
                    <td>
                         <!-- Date -->
                         29. 1. 2026
                    </td>
                    <td>
                         <!-- Actions/Links cell -->
                         <!-- Unwanted info link with specific sysid -->
                         <a href="/auth/dok_server/dokumenty_ct.pl?id=1728;lang=cz">
                            <img sysid="mime-prohlizeni-info" src="info.gif">
                         </a>

                         <!-- Another unwanted info link with just type implied -->
                         <a href="/auth/dok_server/dokumenty_ct.pl?id=9999;lang=cz">
                            <img sysid="mime-prohlizeni-info" src="info2.gif">
                         </a>

                         <!-- WANTED download link -->
                         <a href="/auth/dok_server/slozka.pl?download=350247;id=150953;z=1;lang=cz">
                            <img sysid="mime-pdf" src="pdf.gif">
                         </a>
                    </td>
                </tr>
            </table>
        `;

    const result = parseServerFiles(html);
    const file = result.files[0];

    expect(result.files).toHaveLength(1);
    expect(file.file_name).toBe('Přednáška 92 -- abstraktní datové typy moduly');

    // Before fix: This would likely have 3 files/links
    // After fix: Should have only 1
    expect(file.files).toHaveLength(1);
    expect(file.files[0].link).toContain('slozka.pl?download=');
    expect(file.files[0].type).toBe('pdf');
  });

  it('should ignore Document Server system menu even if it has >= 5 cells', () => {
    const html = `
            <table class="portal_menu">
                <tr>
                    <td class="portal_menu_hole"></td>
                    <td class="odsazena active"><b><a href="index.pl?lang=en">Document tree</a></b></td>
                    <td class="portal_menu_hole"></td>
                    <td class="odsazena"><a href="moje_dok.pl?lang=en">All my folders</a></td>
                    <td class="portal_menu_hole"></td>
                    <td class="odsazena"><a href="nove_dok.pl?lang=en">New documents (500)</a></td>
                    <td class="portal_menu_hole"></td>
                </tr>
            </table>
            <table id="tmtab_1">
                <thead>
                    <tr class="zahlavi">
                        <th></th>
                        <th>Ozn.</th>
                        <th>Název</th>
                        <th>Vložil</th>
                        <th>Datum dokumentu</th>
                        <th></th>
                    </tr>
                </thead>
                <tr class="uis-hl-table lbn">
                    <td class="UISTMNumberCell">1</td>
                    <td>Folder</td>
                    <td>Actual File</td>
                    <td>Author</td>
                    <td>Date</td>
                    <td><a href="download.pl?id=1"><img sysid="mime-txt"></a></td>
                </tr>
            </table>
        `;

    const result = parseServerFiles(html);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].file_name).toBe('Actual File');
  });

  it('should filter out localized system labels like "All my folders"', () => {
    const html = `
            <table>
                <tr>
                    <td>1</td>
                    <td>Folder</td>
                    <td>All my folders</td>
                    <td>Author</td>
                    <td>Date</td>
                    <td><a href="moje_dok.pl?lang=en"><img sysid="mime-link"></a></td>
                </tr>
            </table>
        `;

    const result = parseServerFiles(html);
    expect(result.files).toHaveLength(0);
  });
});
