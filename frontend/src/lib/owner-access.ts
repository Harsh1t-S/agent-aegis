const KEY = 'aegis.owner-access';
let temporaryKey: string | undefined;

export function ownerKey(): string {
  if (temporaryKey !== undefined) return temporaryKey;
  try { return sessionStorage.getItem(KEY) ?? ''; } catch { return ''; }
}

export function setOwnerKey(value: string): void {
  temporaryKey = value;
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
    temporaryKey = undefined;
  } catch { /* Keep access in memory if this tab cannot use session storage. */ }
}
