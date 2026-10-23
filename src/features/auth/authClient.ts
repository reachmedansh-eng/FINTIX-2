/**
 * Authentication, behind one small interface.
 *
 * The credentials page only ever talks to `auth`. Today that is a prototype
 * that keeps accounts and the session in this browser's localStorage: there
 * is no server, no network call and no real provider. To move to Supabase (or
 * anything else), write another object with this same shape and export it as
 * `auth` instead. Nothing in the UI needs to change.
 */

export type Session = {
  name: string;
  email: string;
  provider: "password" | "google" | "test";
};

/** Which field an error belongs to, so the form can show it in the right place. */
export type AuthField = "name" | "email" | "password" | "confirm" | "form";

export type AuthResult = { ok: true; session: Session } | { ok: false; field: AuthField; message: string };

export interface AuthClient {
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  /** The demonstration account: no credentials, straight in. */
  signInAsTest(): Session;
  requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }>;
  getSession(): Session | null;
  signOut(): void;
}

/* ------------------------------------------------------------------ */
/* Prototype implementation: this browser only                         */
/* ------------------------------------------------------------------ */

const ACCOUNTS_KEY = "fintix.prototype.accounts";
const SESSION_KEY = "fintix.session";

type Account = { name: string; digest: string };

const TEST_SESSION: Session = { name: "Medansh", email: "test@fintix.demo", provider: "test" };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is unavailable (private window, blocked): the session lasts for this page only.
  }
}

/** Passwords are never stored as typed, even in the prototype. */
async function digest(email: string, password: string) {
  const bytes = new TextEncoder().encode(`${email}\n${password}`);
  if (window.crypto?.subtle) {
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 5381;
  for (const byte of bytes) hash = ((hash << 5) + hash + byte) | 0;
  return `djb2:${hash}`;
}

const normalise = (email: string) => email.trim().toLowerCase();

function open(session: Session): AuthResult {
  write(SESSION_KEY, session);
  return { ok: true, session };
}

const prototypeAuth: AuthClient = {
  async signIn({ email, password }) {
    const key = normalise(email);
    const hash = await digest(key, password);
    const account = (read<Record<string, Account>>(ACCOUNTS_KEY) ?? {})[key];
    if (!account) return { ok: false, field: "email", message: "No account uses this email yet." };
    if (account.digest !== hash) return { ok: false, field: "password", message: "That password isn't right." };
    return open({ name: account.name, email: key, provider: "password" });
  },

  async signUp({ name, email, password }) {
    const key = normalise(email);
    const hash = await digest(key, password);
    const accounts = read<Record<string, Account>>(ACCOUNTS_KEY) ?? {};
    if (accounts[key]) return { ok: false, field: "email", message: "This email already has an account. Sign in instead." };
    accounts[key] = { name: name.trim(), digest: hash };
    write(ACCOUNTS_KEY, accounts);
    return open({ name: name.trim(), email: key, provider: "password" });
  },

  async signInWithGoogle() {
    // No provider is connected yet, and the prototype does not pretend one is.
    return { ok: false, field: "form", message: "Google sign-in isn't connected yet. Use email or the test account for now." };
  },

  signInAsTest() {
    write(SESSION_KEY, TEST_SESSION);
    return TEST_SESSION;
  },

  async requestPasswordReset(email) {
    return { ok: true, message: `Password reset isn't connected yet. Once it is, a link will go to ${normalise(email)}.` };
  },

  getSession() {
    const session = read<Session>(SESSION_KEY);
    // A test session saved before the test profile was renamed still carries the old name.
    return session?.provider === "test" ? TEST_SESSION : session;
  },

  signOut() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
};

export const auth: AuthClient = prototypeAuth;

/* ------------------------------------------------------------------ */
/* Field rules, shared by both forms                                   */
/* ------------------------------------------------------------------ */

export const MIN_PASSWORD = 8;

export const rules = {
  name: (value: string) => (value.trim().length < 2 ? "Enter your full name." : ""),
  email: (value: string) =>
    !value.trim() ? "Enter your email." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? "" : "That doesn't look like an email.",
  password: (value: string) => (!value ? "Enter your password." : ""),
  newPassword: (value: string) =>
    !value ? "Choose a password." : value.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : "",
  confirm: (value: string, password: string) => (!value ? "Type the password again." : value !== password ? "The passwords don't match." : ""),
};
