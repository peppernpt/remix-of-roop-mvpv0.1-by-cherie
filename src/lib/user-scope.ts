// Per-user isolation for client-side persisted state (bag, booking drafts).
//
// Everything a customer types before a booking exists is stored in the browser.
// Those keys MUST be scoped to the authenticated user, otherwise a second user
// signing in on the same browser can see the previous user's data.

const ACTIVE_USER_KEY = "roop:active-user";

/** localStorage prefixes holding customer-specific state. */
export const LOCAL_SCOPED_PREFIXES = ["roop:bag:v1:"];
/** sessionStorage prefixes holding customer-specific state. */
// NOTE: pending-signup stashes (roop:pending-customer:/roop:pending-store:)
// are deliberately NOT scoped — they exist before a user scope exists and are
// matched by email (see lib/pending-profile.ts).
export const SESSION_SCOPED_PREFIXES = ["roop:booking-draft:"];

export const GUEST_SCOPE = "guest";

const safeLocal = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};
const safeSession = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** The user id all scoped keys are currently namespaced under. */
export const getScopeId = (): string => {
  const ls = safeLocal();
  const v = ls?.getItem(ACTIVE_USER_KEY);
  return v && v.length ? v : GUEST_SCOPE;
};

/** Build a storage key namespaced to the active user. */
export const scopedKey = (prefix: string, suffix = ""): string =>
  `${prefix}${getScopeId()}${suffix ? `:${suffix}` : ""}`;

const purge = (storage: Storage | null, prefixes: string[], keepScope: string | null) => {
  if (!storage) return;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const prefix = prefixes.find((p) => key.startsWith(p));
    if (!prefix) continue;
    const rest = key.slice(prefix.length);
    const owner = rest.split(":")[0];
    if (keepScope && owner === keepScope) continue;
    doomed.push(key);
  }
  doomed.forEach((k) => storage.removeItem(k));
};

/**
 * Remove every customer-scoped key. Pass a user id to keep that user's own data
 * (used when switching accounts); pass nothing to wipe all of it (logout).
 */
export const clearCustomerScopedState = (keepScope: string | null = null) => {
  purge(safeLocal(), LOCAL_SCOPED_PREFIXES, keepScope);
  purge(safeSession(), SESSION_SCOPED_PREFIXES, keepScope);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("roop:bag-updated"));
  }
};

/**
 * Point all scoped storage at `userId` (or the guest scope when signed out).
 * Any state belonging to a different scope is destroyed, so a previous user's
 * bag/draft can never be read by the next one.
 */
export const setActiveUser = (userId: string | null) => {
  const ls = safeLocal();
  const next = userId ?? GUEST_SCOPE;
  const prev = getScopeId();
  if (prev === next) return;

  // Guest → signed in: the guest data was entered by the person who just
  // signed in during this same session, so hand it over instead of losing it.
  if (userId && prev === GUEST_SCOPE) {
    const migrate = (storage: Storage | null, prefixes: string[]) => {
      if (!storage) return;
      const moves: Array<[string, string]> = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        const prefix = prefixes.find((p) => key.startsWith(p));
        if (!prefix) continue;
        const rest = key.slice(prefix.length);
        if (!rest.startsWith(`${GUEST_SCOPE}:`) && rest !== GUEST_SCOPE) continue;
        moves.push([key, `${prefix}${userId}${rest.slice(GUEST_SCOPE.length)}`]);
      }
      moves.forEach(([from, to]) => {
        const val = storage.getItem(from);
        storage.removeItem(from);
        if (val !== null) storage.setItem(to, val);
      });
    };
    migrate(safeLocal(), LOCAL_SCOPED_PREFIXES);
    migrate(safeSession(), SESSION_SCOPED_PREFIXES);
  }

  if (ls) {
    if (userId) ls.setItem(ACTIVE_USER_KEY, userId);
    else ls.removeItem(ACTIVE_USER_KEY);
  }
  // Drop everything that does not belong to the new scope.
  clearCustomerScopedState(userId ?? null);
};

