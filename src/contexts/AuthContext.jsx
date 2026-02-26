import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, phoneToEmail } from "../lib/supabase";

const AuthContext = createContext(null);

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

    const name = authUser?.user_metadata?.name || "New User";

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

    throw new Error("No profile found for this account. Create a row in profiles with same auth user id.");
  };

  const syncAuthState = async () => {
    setLoading(true);
    setAuthError("");

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      setSession(data.session);

      if (data.session?.user?.id) {
        const p = await ensureProfile(data.session);
        setProfile(p);
      } else {
        setProfile(null);
      }
    } catch (err) {
      // Do not force-logout on transient profile/network errors.
      // Keep the current session and surface a recoverable error.
      setAuthError(err?.message || "Failed to load account data from Supabase");
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!session?.user?.id) return;
    try {
      const data = await ensureProfile(session);
      setProfile(data);
      setAuthError("");
    } catch (err) {
      setAuthError(err?.message || "Failed to refresh account data");
    }
  };

  useEffect(() => {
    syncAuthState();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setLoading(true);
      setAuthError("");

      try {
        setSession(nextSession);
        if (nextSession?.user?.id) {
          const p = await ensureProfile(nextSession);
          setProfile(p);
          setAuthError("");
        } else {
          setProfile(null);
        }
      } catch (err) {
        // Keep session as-is, expose retryable error instead of logging out.
        setAuthError(err?.message || "Failed to load account data from Supabase");
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

    const { error } = await supabase.auth.signOut();
    if (error) {
      await syncAuthState();
      throw error;
    }
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
