import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const REMEMBER_PREFERENCE_KEY = "vorta:remember-session";

function shouldRememberSession(): boolean {
  return localStorage.getItem(REMEMBER_PREFERENCE_KEY) === "true";
}

const sessionStorageAdapter = {
  getItem(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (shouldRememberSession()) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
      return;
    }

    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  },

  removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberSession(remember: boolean): void {
  if (remember) {
    localStorage.setItem(REMEMBER_PREFERENCE_KEY, "true");
  } else {
    localStorage.removeItem(REMEMBER_PREFERENCE_KEY);
  }
}

export function getRememberSession(): boolean {
  return shouldRememberSession();
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: sessionStorageAdapter,
    },
  },
);
