// reIS-native start-time picker: two DaisyUI selects (hour / minute in 5-min
// steps) instead of the OS <input type="time"> wheel, which looks off-brand and
// scrolls awkwardly. Value is an "HH:MM" string (empty = no time set).
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function ComposerTimeField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  const [h, m] = value ? value.split(':') : ['', ''];
  // The hour gates the value: no hour → no time (so it can be cleared back to
  // empty); picking an hour defaults the minute to 00, which the minute select
  // then refines.
  const set = (nh: string, nm: string) => onChange(nh ? `${nh}:${nm || '00'}` : '');

  return (
    <div className="flex items-center gap-2">
      <select
        className="select select-bordered flex-1"
        aria-label={t('map.hour')}
        value={h}
        onChange={(e) => set(e.target.value, m)}
      >
        <option value="">--</option>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>
            {hh}
          </option>
        ))}
      </select>
      <span className="font-bold text-base-content/50">:</span>
      <select
        className="select select-bordered flex-1"
        aria-label={t('map.minute')}
        value={m}
        onChange={(e) => set(h, e.target.value)}
      >
        <option value="">--</option>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>
            {mm}
          </option>
        ))}
      </select>
    </div>
  );
}
