import { useTranslation } from '../../../hooks/useTranslation';

export function GradingTable({ table, studyForm }: { table: string[][], studyForm: string }) {
    const { t } = useTranslation();
    if (!table.length) return null;
    const headers = table[0];
    let indices = headers.map((_, i) => i);
    if (studyForm === 'prez') indices = indices.filter(i => !headers[i].toLowerCase().includes('kombinovan'));
    else if (studyForm === 'komb') indices = indices.filter(i => !headers[i].toLowerCase().includes('prezenčn'));
    if (indices.length <= 1) indices = headers.map((_, i) => i);

    return (
        <div>
            <h3 className="text-base font-bold mb-3">{t('syllabus.grading')}</h3>
            <div className="overflow-x-auto border border-base-200 rounded-lg">
                <table className="table table-sm w-full">
                    <thead>
                        <tr className="bg-base-200 text-base-content">
                            {indices.map(i => <th key={i} className={i > 0 ? 'text-center' : ''}>{i > 0 && (headers[i].toLowerCase().includes('prezenč') || headers[i].toLowerCase().includes('kombinovan')) ? t('syllabus.weight') : headers[i]}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {table.slice(1).map((row, ri) => <tr key={ri} className="border-b last:border-0 hover:bg-base-200/30">{indices.map(ci => <td key={ci} className={ci > 0 ? 'text-center font-mono' : ''}>{row[ci]}</td>)}</tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
