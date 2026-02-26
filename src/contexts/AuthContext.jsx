import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, phoneToEmail, supabaseConfigError } from "../lib/supabase";

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

  const createDefaultProfileFromAuth = async (authUser) => {
    const phone = extractPhoneFromEmail(authUser?.email);
    if (!phone) return null;

    const name = authUser?.user_metadata?.name || "مستخدم جديد";

    const payload = {
      id: authUser.id,
      name,
      phone,
      role: "user",
      store_name: null,
      points: 0,
      disabled: false
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  };

  const ensureProfile = async (nextSession) => {
    if (!nextSession?.user?.id) return null;

    const existing = await fetchProfile(nextSession.user.id);
    if (existing) return existing;

    const created = await createDefaultProfileFromAuth(nextSession.user);
    if (created) return created;

    throw new Error("لا يوجد ملف حساب مرتبط بهذا المستخدم. أضف سجلًا في جدول profiles بنفس معرّف المستخدم.");
  };

  const syncAuthState = async () => {
    if (supabaseConfigError) {
      setAuthError(supabaseConfigError);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError("");

    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_TIMEOUT_MS,
        "انتهت مهلة التحقق من الجلسة. حاول مرة أخرى."
      );
      if (error) throw error;

      setSession(data.session);

      if (data.session?.user?.id) {
        const p = await withTimeout(
          ensureProfile(data.session),
          AUTH_TIMEOUT_MS,
          "انتهت مهلة تحميل بيانات الحساب. حاول مرة أخرى."
        );
        setProfile(p);
      } else {
        setProfile(null);
      }
    } catch (err) {
      // Do not force-logout on transient profile/network errors.
      // Keep the current session and surface a recoverable error.
      setAuthError(err?.message || "تعذر تحميل بيانات الحساب من Supabase.");
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
        "انتهت مهلة تحديث بيانات الحساب. حاول مرة أخرى."
      );
      setProfile(data);
      setAuthError("");
    } catch (err) {
      setAuthError(err?.message || "تعذر تحديث بيانات الحساب.");
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
            "انتهت مهلة تحديث بيانات الحساب. حاول مرة أخرى."
          )
            .then((p) => {
              setProfile(p);
              setAuthError("");
            })
            .catch((err) => {
              setAuthError(err?.message || "تعذر تحديث بيانات الحساب.");
            });
        } else {
          setProfile(null);
        }

        return;
      }

      setLoading(true);
      setAuthError("");

      try {
        setSession(nextSession);
        if (nextSession?.user?.id) {
          const p = await withTimeout(
            ensureProfile(nextSession),
            AUTH_TIMEOUT_MS,
            "انتهت مهلة تحميل بيانات الحساب. حاول مرة أخرى."
          );
          setProfile(p);
          setAuthError("");
        } else {
          setProfile(null);
        }
      } catch (err) {
        // Keep session as-is, expose retryable error instead of logging out.
        setAuthError(err?.message || "تعذر تحميل بيانات الحساب من Supabase.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async ({ phone, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
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
        "انتهت مهلة تسجيل الخروج. سيتم تنظيف الجلسة المحلية."
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
