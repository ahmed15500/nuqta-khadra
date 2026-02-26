import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createEphemeralSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
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
