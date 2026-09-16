import { useTranslation } from '../../hooks/useTranslation';
import { StatsBars } from './StatsBars';
import type { DayDetail as DayDetailData } from '../../api/usageStats';

/**
 * The picked day: how many devices, how the split fell, and which platforms.
 *
 * The percentage is labelled "of which returning" rather than "retention" on
 * purpose — it is the composition of one day's actives, not the share of an
 * earlier cohort that came back. Calling it retention would overstate it.
 */
export function DayDetail({ detail }: { detail: DayDetailData }) {
  const { t } = useTranslation();
  const label = (k: string) => (k === 'unknown' ? t('admin.stats.unknown') : k);
  const share = detail.active > 0 ? Math.round((detail.returningDevices / detail.active) * 100) : 0;

  return (
    <div className="bg-base-200 rounded-box flex flex-col gap-3 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{detail.day}</h4>
        <span className="text-xs opacity-70">
          {detail.active} {t('admin.stats.activeDevices')}
        </span>
      </div>
      <div className="flex gap-6">
        {(
          [
            ['new', detail.newDevices],
            ['returning', detail.returningDevices],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <div className="text-xs opacity-70">{t(`admin.stats.${k}`)}</div>
            <div className="text-xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
        <div>
          <div className="text-xs opacity-70">{t('admin.stats.ofWhichReturning')}</div>
          <div className="text-xl font-semibold tabular-nums">{share} %</div>
        </div>
      </div>
      <StatsBars groups={detail.byPlatform} labelFor={label} under5={t('admin.stats.under5')} />
    </div>
  );
}
