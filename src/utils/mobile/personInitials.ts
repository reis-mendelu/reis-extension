/**
 * Two letters for an avatar fallback, taken from the NAME rather than from the
 * academic furniture around it.
 *
 * IS writes staff as "Ing. David Procházka, Ph.D." — read naively that is "ID",
 * and every lecturer's avatar ends up spelling out their first degree. Czech
 * titles all carry a full stop ("doc.", "Ing.", "Ph.D.", "RNDr."), and Czech
 * names never do, which makes the dot a reliable filter.
 */
export function personInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const nameWords = words.filter((w) => !w.includes('.'));

  return (nameWords.length > 0 ? nameWords : words)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
