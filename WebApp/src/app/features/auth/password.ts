/** Password policy shared by "Crear cuenta" and "Nueva contraseña". */
export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ['Al menos 12 caracteres', p => p.length >= 12],
  ['Una mayúscula y una minúscula', p => /[A-Z]/.test(p) && /[a-z]/.test(p)],
  ['Al menos un número', p => /\d/.test(p)],
  ['Al menos un símbolo', p => /[^A-Za-z0-9]/.test(p)],
];

export const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];
export const STRENGTH_COLORS = ['#FF6B5E', '#FF6B5E', '#FFB547', '#FFB547', '#8BE08F'];

/** 0–4: one point per satisfied rule. */
export function passwordScore(p: string): number {
  return PASSWORD_RULES.filter(([, test]) => test(p)).length;
}

/** Server rule: 12–128 characters (the other rules only rate strength). */
export function passwordValid(p: string): boolean {
  return p.length >= 12 && p.length <= 128;
}
