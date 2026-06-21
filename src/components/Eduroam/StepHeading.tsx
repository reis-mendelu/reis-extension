/** "① Section title" heading shared by the Step 1 (device) and Step 2 (tutorial) sections. */
export function StepHeading({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-sm">{n}</span>
      <span className="font-semibold text-base text-base-content/80">{label}</span>
    </div>
  );
}
