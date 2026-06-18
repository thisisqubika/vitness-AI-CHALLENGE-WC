import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

interface SessionState {
  session: Session | null;
  ready: boolean;
  error: string | null;
}

/**
 * Establishes an anonymous Supabase session on launch so RLS-gated reads work
 * before there is a real account. Returns readiness so screens can wait for a
 * session before querying. Real accounts + onboarding are a later ticket.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      // If the session is lost (e.g. the anonymous user expired or the backend
      // was reset), re-establish one so the app doesn't get stuck unauthenticated.
      if (event === "SIGNED_OUT") void supabase.auth.signInAnonymously();
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setSession(data.session);
        setReady(true);
        return;
      }
      const { data: signedIn, error: signInError } = await supabase.auth.signInAnonymously();
      if (!active) return;
      if (signInError) {
        setError(
          signInError.message.includes("Anonymous")
            ? "Anonymous sign-in is disabled — enable it in supabase/config.toml."
            : signInError.message,
        );
      } else {
        setSession(signedIn.session);
      }
      setReady(true);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, error };
}
