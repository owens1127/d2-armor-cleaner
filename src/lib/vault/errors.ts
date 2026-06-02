/** User-facing hint for common vault load failures */
export function vaultErrorHint(message: string): string | null {
  const lower = message.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid_grant')) {
    return 'Your Bungie session may have expired. Sign out and sign in again.';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'Bungie rejected the request. Try signing in again, or contact the site administrator if this continues.';
  }
  if (lower.includes('manifest')) {
    return 'Manifest download failed. Check your connection and retry: the first load can take a minute.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Network error. Check your connection or try again in a moment.';
  }
  if (lower.includes('membership') || lower.includes('destiny account')) {
    return 'Could not resolve your Destiny membership. Make sure the account has Destiny 2 characters.';
  }

  return null;
}
