import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase, phoneToEmail, identifierToEmail, supabaseConfigError } from "../lib/supabase";

const AuthContext = createContext(null);
const AUTH_TIMEOUT_MS = 12000;

const withTimeout = async (promise, timeoutMs, message) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const clearSupabaseLocalSession = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  const keys = Object.keys(window.localStorage);
  keys.forEach((key) => {
    if (key.startsWith("sb-")) {
      window.localStorage.removeItem(key);
    }
  });
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const sessionRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  };

  const extractPhoneFromEmail = (email) => {
    if (!email) return null;
    const [localPart] = email.split("@");
    const normalized = localPart?.replace(/[^0-9+]/g, "");
    return normalized || null;
  };

  const ensureProfile = async (nextSession) => {
    if (!nextSession?.user?.id) return null;

    const existing = await fetchProfile(nextSession.user.id);
    if (existing) return existing;

    const phone = extractPhoneFromEmail(nextSession.user?.email) || "-"; throw new Error(`لا يوجد ملف حساب مرتبط بهذا الرقم (${phone}). راجع الإدارة لتعيين الدور الصحيح في profiles.`);
  };

  const syncAuthState = async () => {
    if (supabaseConfigError) {
      setAuthError(supabaseConfigError);
      setLoading(false);
      return;
    }

    const hasUsableState = Boolean(sessionRef.current?.user?.id && profileRef.current?.id);
    if (!hasUsableState) {
      setLoading(true);
      setAuthError("");
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT_MS,
        "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø¬Ù„Ø³Ø©. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
      );
      if (error) throw error;

      setSession(data.session);

      if (data.session?.user?.id) {
        const p = await withTimeout(
          ensureProfile(data.session),
          AUTH_TIMEOUT_MS,
          "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
        );
        setProfile(p);
      } else {
        setProfile(null);
      }
    } catch (err) {
      // Do not force-logout on transient profile/network errors.
      // Keep the current session and surface a recoverable error.
      if (hasUsableState) {
        setAuthError("");
      } else {
        setAuthError(err?.message || "ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨ Ù…Ù† Supabase.");
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!session?.user?.id) return;
    try {
      const data = await withTimeout(
        ensureProfile(session),
        AUTH_TIMEOUT_MS,
        "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
      );
      setProfile(data);
      setAuthError("");
    } catch (err) {
      const hasUsableState = Boolean(profileRef.current?.id === session?.user?.id);
      if (hasUsableState) {
        setAuthError("");
      } else {
        setAuthError(err?.message || "ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨.");
      }
    }
  };

  useEffect(() => {
    syncAuthState();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setAuthError("");
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);

        if (nextSession?.user?.id) {
          withTimeout(
            ensureProfile(nextSession),
            AUTH_TIMEOUT_MS,
            "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
          )
            .then((p) => {
              setProfile(p);
              setAuthError("");
            })
            .catch((err) => {
              const hasUsableState = Boolean(profileRef.current?.id === nextSession.user.id);
              if (hasUsableState) {
                setAuthError("");
              } else {
                setAuthError(err?.message || "ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨.");
              }
            });
        } else {
          setProfile(null);
        }

        return;
      }

      const hasUsableState = Boolean(profileRef.current?.id && profileRef.current.id === nextSession?.user?.id);
      if (!hasUsableState) {
        setLoading(true);
        setAuthError("");
      }

      try {
        setSession(nextSession);
        if (nextSession?.user?.id) {
          const p = await withTimeout(
            ensureProfile(nextSession),
            AUTH_TIMEOUT_MS,
            "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
          );
          setProfile(p);
          setAuthError("");
        } else {
          setProfile(null);
        }
      } catch (err) {
        // Keep session as-is, expose retryable error instead of logging out.
        if (hasUsableState) {
          setAuthError("");
        } else {
          setAuthError(err?.message || "ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨ Ù…Ù† Supabase.");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const shouldRecover = () =>
      document.visibilityState === "visible" &&
      (!sessionRef.current?.user?.id || !profileRef.current?.id || Boolean(authError));

    const handleVisibilityChange = () => {
      if (shouldRecover()) {
        syncAuthState();
      }
    };

    const handleFocus = () => {
      if (shouldRecover()) {
        syncAuthState();
      }
    };

    const handleOnline = () => {
      if (shouldRecover()) {
        syncAuthState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, [authError]);

  const login = async ({ phone, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: identifierToEmail(phone),
      password
    });
    if (error) throw error;
  };

  const register = async ({ name, phone, password }) => {
    const email = phoneToEmail(phone);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        name,
        phone,
        role: "user",
        store_name: null,
        points: 0,
        disabled: false
      });

      if (upsertError) throw upsertError;
    }
  };

  const logout = async () => {
    // Optimistically clear client state so UI exits protected screens immediately.
    setSession(null);
    setProfile(null);
    setAuthError("");
    setLoading(false);

    try {
      const { error } = await withTimeout(
        supabase.auth.signOut(),
        8000,
        "Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬. Ø³ÙŠØªÙ… ØªÙ†Ø¸ÙŠÙ Ø§Ù„Ø¬Ù„Ø³Ø© Ø§Ù„Ù…Ø­Ù„ÙŠØ©."
      );
      if (error) throw error;
    } catch (_err) {
      // Fallback: clear local persisted auth to avoid stuck authenticated UI.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore fallback errors
      }
      clearSupabaseLocalSession();
    }

    setLoading(false);
  };

  const value = useMemo(
    () => ({ session, profile, loading, authError, login, register, logout, refreshProfile, syncAuthState }),
    [session, profile, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

