/**
 * Authentication is not wired into the application yet. Keep this boundary
 * explicit so repositories can start enforcing owner_id as soon as the app's
 * session provider is connected to Neon Auth.
 */
export async function getCurrentUserId(): Promise<string | null> {
  return null;
}
