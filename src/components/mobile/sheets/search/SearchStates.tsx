import { Loader2 } from 'lucide-react';

/** Shared empty/in-flight rows for both halves of the search sheet. */
export function NoResults({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-base-content/50">{text}</p>;
}

export function Searching({ text }: { text: string }) {
  return (
    <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-base-content/50">
      <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" />
      {text}
    </p>
  );
}
