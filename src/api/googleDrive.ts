/**
 * Minimal Google Drive operations under the `drive.file` scope.
 *
 * Creation is idempotent: folders are found-or-created by name+parent, and files
 * carry an `appProperties.reisLink` stamp so an already-uploaded file is
 * recognised even after the local manifest is lost. This is what stops a backup
 * that's interrupted mid-run from duplicating folders/files on the next pass.
 */

import { getAccessToken } from './googleAuth';

const UPLOAD_ENDPOINT =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export interface DriveFile {
    id: string;
    name: string;
    webViewLink?: string;
}

/** Escape a value for use inside a Drive query string literal. */
function escapeQ(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Run a Drive files.list query, returning the matched files (drive.file scope: only app-created). */
async function listFiles(q: string, fields = 'files(id,name)'): Promise<Array<Record<string, unknown>>> {
    const token = await getAccessToken();
    const url = `${FILES_ENDPOINT}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=10&spaces=drive`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive list failed: ${data?.error?.message || res.statusText}`);
    return (data.files as Array<Record<string, unknown>>) ?? [];
}

/** Find a non-trashed folder by exact name under `parentId` ('root' for My Drive). */
export async function findFolder(name: string, parentId: string): Promise<string | null> {
    const q = `mimeType = '${FOLDER_MIME}' and name = '${escapeQ(name)}' and '${escapeQ(parentId)}' in parents and trashed = false`;
    const files = await listFiles(q, 'files(id)');
    return (files[0]?.id as string) ?? null;
}

/** Create a folder (optionally inside `parentId`) and return its id. */
export async function createFolder(name: string, parentId?: string): Promise<string> {
    const token = await getAccessToken();
    const metadata: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
    if (parentId) metadata.parents = [parentId];

    const res = await fetch(`${FILES_ENDPOINT}?fields=id`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive folder create failed: ${data?.error?.message || res.statusText}`);
    return data.id as string;
}

/** Reuse an existing folder of this name under the parent, or create one. Idempotent. */
export async function ensureFolder(name: string, parentId?: string): Promise<string> {
    const found = await findFolder(name, parentId ?? 'root');
    if (found) return found;
    return await createFolder(name, parentId);
}

/** Fetch a file/folder's webViewLink (the URL that opens it in the Drive UI). */
export async function getFileLink(fileId: string): Promise<string | null> {
    const token = await getAccessToken();
    const res = await fetch(`${FILES_ENDPOINT}/${fileId}?fields=webViewLink`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive get link failed: ${data?.error?.message || res.statusText}`);
    return (data.webViewLink as string) ?? null;
}

/** Find a non-trashed file previously stamped with this appProperties value. */
export async function findFileByProperty(key: string, value: string): Promise<string | null> {
    const q = `appProperties has { key='${escapeQ(key)}' and value='${escapeQ(value)}' } and trashed = false`;
    const files = await listFiles(q, 'files(id)');
    return (files[0]?.id as string) ?? null;
}

/**
 * Upload a single file to the user's Drive. With `drive.file` the app can only
 * see/manage files it created, so `parents` may reference only app-created
 * folders (or be omitted to land in the Drive root). `appProperties` stamps the
 * file with stable metadata (we store the IS-link hash for dedup).
 */
export async function uploadFile(
    name: string,
    content: Blob,
    parents?: string[],
    appProperties?: Record<string, string>,
): Promise<DriveFile> {
    const token = await getAccessToken();

    const metadata: Record<string, unknown> = { name };
    if (parents && parents.length) metadata.parents = parents;
    if (appProperties) metadata.appProperties = appProperties;

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

/** Permanently delete a Drive file/folder. Deleting a folder removes its descendants. */
export async function deleteFile(fileId: string): Promise<void> {
    const token = await getAccessToken();
    const res = await fetch(`${FILES_ENDPOINT}/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(`Drive delete failed: ${data?.error?.message || res.statusText}`);
    }
}

/** Replace the content of an existing Drive file (used when the IS file changed). */
export async function updateFileContent(fileId: string, content: Blob): Promise<DriveFile> {
    const token = await getAccessToken();
    const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,webViewLink`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: content },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Drive update failed: ${data?.error?.message || res.statusText}`);
    return data as DriveFile;
}
