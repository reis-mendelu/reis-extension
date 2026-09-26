import type { Society } from '../../../types/events';
import { SOCIETY_LOGO_BUCKET } from '../../../api/societies';
import {
  insertSociety,
  removeSocietyLogo,
  updateSociety,
  uploadSocietyLogo,
  type SocietyInput,
} from '../../../api/societiesAdmin';
import { encodeSocietyLogo } from '../../../utils/societies/encodeSocietyLogo';

export type SaveSocietyError = 'logo_required' | 'upload_failed' | 'save_failed';

/** What the admin writes need from the slice: the catalog and the local upsert. */
interface SocietiesAccess {
  societies: () => Record<string, Society>;
  put: (society: Society) => Promise<void>;
}

const LOGO_MARKER = `/object/public/${SOCIETY_LOGO_BUCKET}/`;

/** The storage path back out of a public URL, for deleting a replaced logo. */
export function logoPathFromUrl(url: string): string | null {
  const at = url.indexOf(LOGO_MARKER);
  return at === -1 ? null : url.slice(at + LOGO_MARKER.length);
}

/**
 * Order matters and is the whole design: logo first (a row may never point at
 * a file that is not there), then the row, then, only once the row points at
 * the new file, the old file is deleted. A failure at any step leaves the
 * society as it was, apart from an orphaned upload, which costs a few KB.
 */
export async function saveSociety(
  access: SocietiesAccess,
  input: SocietyInput,
  logo: Blob | null,
  isNew: boolean
): Promise<{ error?: SaveSocietyError }> {
  if (isNew && !logo) return { error: 'logo_required' };
  const previous = access.societies()[input.id];

  let logoPath: string | null = null;
  if (logo) {
    logoPath = await uploadSocietyLogo(input.id, await encodeSocietyLogo(logo));
    if (!logoPath) return { error: 'upload_failed' };
  }

  const saved =
    isNew && logoPath
      ? await insertSociety(input, logoPath, nextSortOrder(access.societies()))
      : await updateSociety(input.id, {
          name: input.name.trim(),
          short_name: input.shortName.trim(),
          color: input.color,
          faculty_key: input.facultyKey,
          auto_follow_faculty: input.autoFollowFaculty,
          ...(logoPath ? { logo_path: logoPath } : {}),
        });
  if (!saved) return { error: 'save_failed' };
  await access.put({ ...previous, ...saved });

  const oldPath = previous?.logo ? logoPathFromUrl(previous.logo) : null;
  if (logoPath && oldPath && oldPath !== logoPath) await removeSocietyLogo(oldPath);
  return {};
}

export async function setSocietyActive(
  access: SocietiesAccess,
  id: string,
  active: boolean
): Promise<boolean> {
  const saved = await updateSociety(id, { is_active: active });
  if (!saved) return false;
  await access.put({ ...access.societies()[id], ...saved, isActive: active });
  return true;
}

/** New societies go to the end of every list. */
function nextSortOrder(catalog: Record<string, Society>): number {
  return Math.max(0, ...Object.values(catalog).map((s) => s.sortOrder)) + 10;
}
