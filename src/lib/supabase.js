import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pqevttogkdjyedljtyyd.supabase.co";
const supabaseAnonKey = "sb_publishable_asDp-LKRawMRSaPIQi9i6w_dm0XTBvw";
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseEnv) {
  // Keep app booting and surface a visible auth error screen instead of a white page crash.
  console.error("متغيرات Supabase غير موجودة. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.");
}

export const supabaseConfigError = hasSupabaseEnv
  ? ""
  : "متغيرات Supabase غير مضبوطة (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).";

// Android browsers (notably Brave/WebView) can deadlock on the Web Locks API
// that supabase-js uses to guard the auth token, producing
// "Navigator LockManager lock ... timed out" errors that break sign-in and
// profile loading. Use a passthrough lock: auth operations run immediately
// without acquiring a cross-tab Web Lock.
const passthroughLock = async (name, acquireTimeout, fn) => await fn();

export const supabase = createClient(
  supabaseUrl || "https://invalid.supabase.co",
  supabaseAnonKey || "invalid-anon-key",
  {
    auth: {
      lock: passthroughLock
    }
  }
);

export const createEphemeralSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      lock: passthroughLock
    }
  });

const isMissingFunctionError = (fnName, error) =>
  typeof error?.message === "string" &&
  error.message.includes(`Could not find the function public.${fnName}`);

export async function rpcWithArgFallback(fnName, argCandidates = []) {
  let lastError = null;

  for (const args of argCandidates) {
    const { data, error } = await supabase.rpc(fnName, args);
    if (!error) return { data, error: null };

    lastError = error;
    if (!isMissingFunctionError(fnName, error)) break;
  }

  return { data: null, error: lastError };
}

export const roles = {
  COLLECTOR: "collector_store",
  USER: "user",
  PARTNER: "partner_store",
  ADMIN: "admin"
};

export const phoneToEmail = (phone) => `${phone.replace(/[^0-9+]/g, "")}@nuqta.app`;
export const adminLoginEmail = import.meta.env.VITE_ADMIN_LOGIN_EMAIL || "01000000004@nuqta.app";

export const identifierToEmail = (identifier) => {
  const raw = String(identifier || "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "admin") return adminLoginEmail;
  return phoneToEmail(raw);
};
