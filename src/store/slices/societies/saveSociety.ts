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
import { encodePartnerMark } from '../../../utils/societies/encodePartnerMark';

/** A partner's light and dark colour marks; null = not changed. */
export interface PartnerMarks {
  light: Blob | null;
  dark: Blob | null;
}

/** undefined = nothing picked; null = the upload failed; else the stored path. */
async function uploadMark(id: string, png: Blob | null): Promise<string | null | undefined> {
  if (!png) return undefined;
  return uploadSocietyLogo(id, png);
}

export type SaveSocietyError =
  'logo_required' | 'logo_too_large' | 'mark_too_large' | 'upload_failed' | 'save_failed';

/** Every picked image as an upload-ready PNG, or which one cannot get under the bucket's limit. */
async function encodeAll(logo: Blob | null, marks: PartnerMarks) {
  const png = logo ? await encodeSocietyLogo(logo) : null;
  if (logo && !png) return 'logo_too_large' as const;
  const light = marks.light ? await encodePartnerMark(marks.light) : null;
  const dark = marks.dark ? await encodePartnerMark(marks.dark) : null;
  if ((marks.light && !light) || (marks.dark && !dark)) return 'mark_too_large' as const;
  return { png, light, dark };
}

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
  isNew: boolean,
  marks: PartnerMarks = { light: null, dark: null }
): Promise<{ error?: SaveSocietyError }> {
  if (isNew && !logo) return { error: 'logo_required' };
  const previous = access.societies()[input.id];
  // Encode everything before uploading anything: an image that cannot fit is
  // reported as such, and no earlier file is left behind as an orphan.
  const encoded = await encodeAll(logo, marks);
  if (typeof encoded === 'string') return { error: encoded };

  let logoPath: string | null = null;
  if (encoded.png) {
    logoPath = await uploadSocietyLogo(input.id, encoded.png);
    if (!logoPath) return { error: 'upload_failed' };
  }

  // Marks follow the logo's rule: uploaded before any row points at them.
  const lightPath = await uploadMark(input.id, encoded.light);
  const darkPath = await uploadMark(input.id, encoded.dark);
  if (lightPath === null || darkPath === null) return { error: 'upload_failed' };
  const markPatch = {
    ...(lightPath ? { mark_light_path: lightPath } : {}),
    ...(darkPath ? { mark_dark_path: darkPath } : {}),
  };

  const saved =
    isNew && logoPath
      ? await insertSociety(input, logoPath, nextSortOrder(access.societies()), markPatch)
      : await updateSociety(input.id, {
          name: input.name.trim(),
          short_name: input.shortName.trim(),
          color: input.color,
          faculty_key: input.facultyKey,
          auto_follow_faculty: input.autoFollowFaculty,
          ...(input.instagram !== undefined ? { instagram: input.instagram } : {}),
          ...(input.kind ? { kind: input.kind, audience: input.audience ?? null } : {}),
          ...(logoPath ? { logo_path: logoPath } : {}),
          ...markPatch,
        });
  if (!saved) return { error: 'save_failed' };
  await access.put({ ...previous, ...saved });

  const oldPath = previous?.logo ? logoPathFromUrl(previous.logo) : null;
  if (logoPath && oldPath && oldPath !== logoPath) await removeSocietyLogo(oldPath);
  // Marks are content-addressed too: a replaced one would stay forever.
  const oldLight = previous?.markLight ? logoPathFromUrl(previous.markLight) : null;
  if (lightPath && oldLight && oldLight !== lightPath) await removeSocietyLogo(oldLight);
  const oldDark = previous?.markDark ? logoPathFromUrl(previous.markDark) : null;
  if (darkPath && oldDark && oldDark !== darkPath) await removeSocietyLogo(oldDark);
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
