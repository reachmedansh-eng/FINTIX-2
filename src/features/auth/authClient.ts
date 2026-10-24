import { createClient, type AuthError, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Authentication, behind one small interface.
 *
 * The credentials page only ever talks to `auth`. With the Supabase project's
 * URL and publishable key in the environment (NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY), that is Supabase Auth: email and password,
 * Google, and the test account as an anonymous sign-in. Without them it is the
 * prototype below, which keeps accounts in this browser's localStorage.
 *
 * Either way the signed-in profile is mirrored under one localStorage key, so
 * the navigation bar can read it synchronously on every screen.
 */

export type Session = {
  name: string;
  email: string;
  provider: "password" | "google" | "test";
  /** Neo has already shown this player around (kept on their account). */
  toured?: boolean;
};

/** Which field an error belongs to, so the form can show it in the right place. */
export type AuthField = "name" | "email" | "password" | "confirm" | "form";

export type AuthResult = { ok: true; session: Session } | { ok: false; field: AuthField; message: string };

/** Google sign-in leaves for Google's own page, and the visitor comes back to the credentials page signed in. */
export type GoogleResult = AuthResult | { ok: "leaving" };

export interface AuthClient {
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  signInWithGoogle(): Promise<GoogleResult>;
  /** Back from Google: the session it brought, why it failed, or null when this visit isn't a return from Google. */
  completeRedirect(): Promise<AuthResult | null>;
  /** The demonstration account: no credentials, straight in. */
  signInAsTest(): Promise<Session>;
  requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }>;
  getSession(): Session | null;
  /** Remember on the player's account that Neo's tour has been given. */
  markToured(): void;
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
    // Without the Supabase project no provider is connected, and the prototype does not pretend one is.
    return { ok: false, field: "form", message: "Google sign-in isn't connected yet. Use email or the test account for now." };
  },

  async completeRedirect() {
    return null;
  },

  async signInAsTest() {
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

  markToured() {
    // The prototype has no account to keep it on; the tour remembers it in this browser.
  },

  signOut() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
};

/* ------------------------------------------------------------------ */
/* Supabase implementation                                             */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

/** One client per page, made on first use in the browser. It keeps the Supabase session in localStorage and refreshes it. */
function client() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    // Keep the mirrored profile in step: a refreshed, changed or ended session updates it.
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) write(SESSION_KEY, profile(session.user));
      else if (event === "SIGNED_OUT") forget();
    });
  }
  return supabase;
}

function forget() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing stored, nothing to remove.
  }
}

/** The profile the app shows for a Supabase user. */
function profile(user: User): Session {
  if (user.is_anonymous) return TEST_SESSION;
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const name = String(meta.full_name || meta.name || email.split("@")[0] || "Player").trim();
  return { name, email, provider: user.app_metadata?.provider === "google" ? "google" : "password", toured: Boolean(meta.fintix_toured) };
}

const OFFLINE = "Couldn't reach the FINTIX server. Check your connection and try again.";

/** Supabase's errors, in the form's words and against the field they belong to. */
function explain(error: AuthError | null, during: "signin" | "signup"): { ok: false; field: AuthField; message: string } {
  const code = error?.code ?? "";
  if (code === "invalid_credentials") return { ok: false, field: "password", message: "That email and password don't match an account." };
  if (code === "user_already_exists" || code === "email_exists") return { ok: false, field: "email", message: "This email already has an account. Sign in instead." };
  if (code === "weak_password") return { ok: false, field: "password", message: `Use at least ${MIN_PASSWORD} characters.` };
  if (code === "email_address_invalid") return { ok: false, field: "email", message: "That email can't be used. Try another." };
  if (code === "email_not_confirmed") return { ok: false, field: "form", message: "Confirm your email first: open the link we sent you." };
  if (code.startsWith("over_")) return { ok: false, field: "form", message: "Too many tries just now. Wait a minute and try again." };
  if (!error || error.name === "AuthRetryableFetchError" || error.status === 0) return { ok: false, field: "form", message: OFFLINE };
  return { ok: false, field: "form", message: during === "signin" ? "Couldn't sign you in. Try again in a moment." : "Couldn't create your account. Try again in a moment." };
}

/** Where Google (or a reset link) sends the visitor back to: this same page, under whatever path the site is served from. */
const backHere = () => window.location.origin + window.location.pathname;

const supabaseAuth: AuthClient = {
  async signIn({ email, password }) {
    try {
      const { data, error } = await client().auth.signInWithPassword({ email: normalise(email), password });
      if (error || !data.user) return explain(error, "signin");
      return open(profile(data.user));
    } catch {
      return { ok: false, field: "form", message: OFFLINE };
    }
  },

  async signUp({ name, email, password }) {
    try {
      const { data, error } = await client().auth.signUp({ email: normalise(email), password, options: { data: { full_name: name.trim() } } });
      if (error || !data.user) return explain(error, "signup");
      // With email confirmation switched on in the project, there is no session until the link is opened.
      if (!data.session) return { ok: false, field: "form", message: `Almost there: open the link we sent to ${normalise(email)} to finish.` };
      return open(profile(data.user));
    } catch {
      return { ok: false, field: "form", message: OFFLINE };
    }
  },

  async signInWithGoogle() {
    try {
      const { error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: backHere() } });
      if (error) return { ok: false, field: "form", message: "Couldn't open Google sign-in. Try again in a moment." };
      return { ok: "leaving" };
    } catch {
      return { ok: false, field: "form", message: OFFLINE };
    }
  },

  completeRedirect() {
    // Read once per page: the answer is taken off the address after the first look, and a second caller gets the same result.
    returned ??= readReturn();
    return returned;
  },

  async signInAsTest() {
    try {
      // Each visit to the test account is its own anonymous player in Supabase.
      await client().auth.signInAnonymously();
    } catch {
      // Unreachable server: the test account still opens, in this browser only.
    }
    write(SESSION_KEY, TEST_SESSION);
    return TEST_SESSION;
  },

  async requestPasswordReset(email) {
    try {
      const { error } = await client().auth.resetPasswordForEmail(normalise(email), { redirectTo: backHere() });
      if (error?.code?.startsWith("over_")) return { ok: false, message: "Too many reset emails just now. Wait a while and try again." };
      if (error) return { ok: false, message: "Couldn't send a reset link. Try again in a moment." };
      return { ok: true, message: `If ${normalise(email)} has an account, a sign-in link is on its way.` };
    } catch {
      return { ok: false, message: OFFLINE };
    }
  },

  getSession() {
    const session = read<Session>(SESSION_KEY);
    return session?.provider === "test" ? TEST_SESSION : session;
  },

  markToured() {
    const session = read<Session>(SESSION_KEY);
    if (!session || session.provider === "test" || session.toured) return;
    write(SESSION_KEY, { ...session, toured: true });
    client()
      .auth.updateUser({ data: { fintix_toured: true } })
      .catch(() => {
        // Offline: this browser still remembers, and the account learns next time the tour finishes.
      });
  },

  signOut() {
    forget();
    client()
      .auth.signOut({ scope: "local" })
      .catch(() => {
        // Already signed out on this device; the mirrored profile is cleared either way.
      });
  },
};

let returned: Promise<AuthResult | null> | null = null;

/** Google's answer, if this page was opened by one: the session it brought, or why it didn't. */
async function readReturn(): Promise<AuthResult | null> {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const failed = query.get("error") ?? hash.get("error");
  if (!query.has("code") && !hash.has("access_token") && failed === null) return null;
  try {
    // The client reads the answer from the address as it starts; this waits for that.
    const { data } = await client().auth.getSession();
    // A refusal is reported even if an older session (the test account, say) is still open in this browser.
    if (failed === "access_denied") return { ok: false, field: "form", message: "Google sign-in was cancelled. Try again, or use email." };
    if (failed === null && data.session?.user) return open(profile(data.session.user));
    return { ok: false, field: "form", message: "Google sign-in didn't finish. Try again, or use email." };
  } catch {
    return { ok: false, field: "form", message: OFFLINE };
  } finally {
    // Take the answer off the address, so a reload doesn't try to use it twice.
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }
}

export const auth: AuthClient = SUPABASE_URL && SUPABASE_KEY ? supabaseAuth : prototypeAuth;

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
