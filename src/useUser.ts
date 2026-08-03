import { useCallback, useEffect, useState } from "react";

const USER_ID_KEY = "vigadi_user_id";

export interface Account {
  id: string;
  username: string;
  email: string | null;
}

/**
 * The id a browser uses before signing up. Signing up claims this id, so the
 * food plan built as a guest belongs to the new account with nothing copied.
 */
export function getGuestId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `user-${Date.now()}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

type AuthResult = { ok: boolean; error?: string };

async function post(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Single source of truth for "who am I". Returns the signed-in account when a
 * session exists, and falls back to the browser's guest id otherwise.
 */
export function useUser() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setAccount(data.user ?? null);
      }
    } catch {
      /* offline — stay a guest */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signup = useCallback(
    async (username: string, password: string, email?: string): Promise<AuthResult> => {
      try {
        const res = await post("/api/auth/signup", {
          username,
          password,
          email: email || null,
          guestId: getGuestId(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || "Could not create account." };
        setAccount(data.user);
        // Keep pointing at the same profile row the account just claimed.
        localStorage.setItem(USER_ID_KEY, data.user.id);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error — check your connection." };
      }
    },
    []
  );

  const login = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    try {
      const res = await post("/api/auth/login", { username, password });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || "Could not sign in." };
      setAccount(data.user);
      localStorage.setItem(USER_ID_KEY, data.user.id);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — check your connection." };
    }
  }, []);

  const logout = useCallback(async () => {
    await post("/api/auth/logout").catch(() => undefined);
    setAccount(null);
    // Drop the account id so the next guest session is genuinely separate.
    localStorage.removeItem(USER_ID_KEY);
  }, []);

  return {
    account,
    userId: account?.id ?? getGuestId(),
    isSignedIn: !!account,
    isLoading,
    signup,
    login,
    logout,
    refresh,
  };
}
