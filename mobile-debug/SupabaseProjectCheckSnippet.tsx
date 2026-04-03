import { useEffect } from "react";
import { supabase } from "./supabaseClient.ts";

const EXPECTED_REF = "vzwvnhgorvqnwluzxtkk";
const CHECK_SUBMISSION_ID = "1a8e414c-0839-4401-8ca9-ffdeb8e0323a";

function extractRefFromUrl(url?: string | null) {
  if (!url) return null;
  const m = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

type JwtPayload = {
  ref?: string;
  [key: string]: unknown;
};

type MissionSubmissionPreview = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  user_id: string | null;
  mission_id: string | null;
  updated_at: string | null;
};

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function decodeJwtPayload(token?: string | null): JwtPayload | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getEnvValue(key: string): string | null {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return processEnv?.[key] ?? null;
}

export async function debugMobileSupabaseTarget() {
  try {
    const supabaseUrl =
      getEnvValue("EXPO_PUBLIC_SUPABASE_URL") ||
      getEnvValue("SUPABASE_URL") ||
      null;

    const anonKey =
      getEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
      getEnvValue("SUPABASE_ANON_KEY") ||
      null;

    const urlRef = extractRefFromUrl(supabaseUrl);
    const jwtPayload = decodeJwtPayload(anonKey);
    const keyRef = jwtPayload?.ref ?? null;

    console.log("[mobile-env] SUPABASE_URL:", supabaseUrl);
    console.log("[mobile-env] URL ref:", urlRef);
    console.log("[mobile-env] Key ref:", keyRef);
    console.log("[mobile-env] Expected ref:", EXPECTED_REF);

    const sameProject =
      urlRef === EXPECTED_REF && (keyRef === EXPECTED_REF || keyRef == null);

    console.log(
      "[mobile-env] Project match:",
      sameProject,
      sameProject ? "PASS" : "FAIL"
    );

    // Get currently logged-in user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id ?? null;
    console.log("[mobile-auth] Currently logged in user ID:", currentUserId);
    if (!currentUserId) {
      console.log("[mobile-auth] FAIL: user not logged in, cannot validate mission_submissions RLS.");
    }

    // Try direct ID lookup (will return null if RLS blocks)
    const { data, error } = await supabase
      .from("mission_submissions")
      .select("id,status,submitted_at,reviewed_at,user_id,mission_id,updated_at")
      .eq("id", CHECK_SUBMISSION_ID)
      .maybeSingle();

    if (error) {
      console.log("[mobile-db] Submission lookup error:", error);
    } else {
      console.log("[mobile-db] Submission row (ID lookup):", data);
      if (data) {
        console.log(
          "[mobile-db] Submission user_id:",
          data.user_id,
          "Current session user_id:",
          currentUserId,
          "Match:",
          data.user_id === currentUserId
        );
      } else {
        console.log(
          "[mobile-db] FAIL: target submission not found in this Supabase project or blocked by RLS.",
          CHECK_SUBMISSION_ID
        );
      }
    }

    // Query ALL submissions accessible from this session (to see what RLS allows)
    const { data: allMySubs, error: allSubsError } = await supabase
      .from("mission_submissions")
      .select(
        "id,status,submitted_at,reviewed_at,user_id,mission_id,updated_at"
      )
      .order("submitted_at", { ascending: false })
      .limit(5);

    if (allSubsError) {
      console.log("[mobile-db] All submissions query error:", allSubsError);
    } else {
      console.log(
        "[mobile-db] Submissions accessible to this session (first 5):",
        allMySubs?.map((s: MissionSubmissionPreview) => ({ id: s.id, user_id: s.user_id, status: s.status }))
      );
      const targetSubmissionInList = allMySubs?.some((s: MissionSubmissionPreview) => s.id === CHECK_SUBMISSION_ID);
      console.log(
        "[mobile-db] Target submission",
        CHECK_SUBMISSION_ID,
        "visible in accessible list:",
        targetSubmissionInList,
        targetSubmissionInList ? "PASS" : "FAIL"
      );
    }

    const { count, error: pendingError } = await supabase
      .from("mission_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (pendingError) {
      console.log("[mobile-db] Pending count error:", pendingError);
    } else {
      console.log("[mobile-db] Pending count visible from mobile session:", count);
    }

    console.log(
      "[mobile-debug] Next action:",
      sameProject
        ? "If submission still missing, mobile submit mutation is not writing to mission_submissions in this project."
        : "Fix mobile env URL/key to expected project ref first."
    );
  } catch (e) {
    console.log("[mobile-debug] Fatal error:", e);
  }
}

export function SupabaseDebugOnLaunch() {
  useEffect(() => {
    void debugMobileSupabaseTarget();
  }, []);

  return null;
}
