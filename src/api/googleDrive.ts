/**
 * Minimal Google Drive uploads under the `drive.file` scope.
 *
 * Phase 0: prove we can push one file into the user's Drive. Multipart upload
 * (metadata + bytes in one request) is enough for the file sizes IS Mendelu
 * serves; resumable uploads are a Phase 1 concern for large files.
 */

import { getAccessToken } from './googleAuth';

const UPLOAD_ENDPOINT =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

export interface DriveFile {
    id: string;
    name: string;
    webViewLink?: string;
}

/**
 * Upload a single file to the user's Drive. With `drive.file` the app can only
 * see/manage files it created, so `parents` may reference only app-created
 * folders (or be omitted to land in the Drive root).
 */
export async function uploadFile(
    name: string,
    content: Blob,
    parents?: string[],
): Promise<DriveFile> {
    const token = await getAccessToken();

    const metadata: Record<string, unknown> = { name };
    if (parents && parents.length) metadata.parents = parents;

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', content);

    const res = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error?.message || res.statusText;
        throw new Error(`Drive upload failed: ${msg}`);
    }
    return data as DriveFile;
}
