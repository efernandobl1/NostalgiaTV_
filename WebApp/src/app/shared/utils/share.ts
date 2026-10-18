/** Copies an absolute link to an app path (share buttons; no backend involved). */
export function copyLink(path: string): void {
  const url = new URL(path, window.location.origin).href;
  navigator.clipboard?.writeText(url).catch(() => undefined);
}
