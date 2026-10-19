/** Display labels for the interlude enums (API values are English constants). */
export const KIND_LABELS: Record<string, string> = { Bumper: 'Bumper', Advertisement: 'Anuncio' };
export const BUMPER_LABELS: Record<string, string> = { ComingUp: 'Ya viene', WeContinueWith: 'Continuamos con', Generic: 'Genérico' };
export const SEASON_LABELS: Record<string, string> = { AllYear: 'Todo el año', Halloween: 'Halloween', Christmas: 'Navidad' };

export function interludeLabel(kind: string, bumperType: string | null): string {
  return kind === 'Bumper' ? `Bumper · ${BUMPER_LABELS[bumperType ?? ''] ?? 'Genérico'}` : KIND_LABELS[kind] ?? kind;
}

/** Short tag + color used in lists: "YA VIENE" violet, "ANUNCIO" cyan. */
export function interludeTag(kind: string, bumperType: string | null): { tag: string; color: string } {
  if (kind !== 'Bumper') return { tag: 'ANUNCIO', color: '#6FD0EA' };
  const tag = bumperType === 'ComingUp' ? 'YA VIENE' : bumperType === 'WeContinueWith' ? 'CONTINUAMOS' : 'GENÉRICO';
  return { tag, color: '#B8A6FF' };
}

export function duration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
