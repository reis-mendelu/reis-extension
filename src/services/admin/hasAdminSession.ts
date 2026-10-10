import { adminAuthClient } from './authClient';

/** A stored admin session exists. Local read only, so it answers offline. */
export async function hasAdminSession(): Promise<boolean> {
  try {
    const { data } = await adminAuthClient.auth.getSession();
    return data.session !== null;
  } catch {
    return false;
  }
}
