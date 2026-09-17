/** "① Section title" heading shared by the Step 1 (device) and Step 2 (tutorial) sections. */
export function StepHeading({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {/* `--tone-primary`, not raw `text-primary`: the badge number measured
          2.03:1 on its own /15 tint in the light theme. The token is the
          project's answer for a semantic colour used as text. */}
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-[var(--tone-primary)] font-bold text-sm">
        {n}
      </span>
      <span className="font-semibold text-base text-base-content/80">{label}</span>
    </div>
  );
}
