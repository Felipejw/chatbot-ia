import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export function useFollowUpPoller() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke("process-follow-ups", {
          body: { time: new Date().toISOString(), source: "poller" },
        });

        if (error) {
          console.warn("[FollowUpPoller] Error:", error.message);
        } else if (data?.processed > 0) {
          console.log(`[FollowUpPoller] Processed ${data.processed} follow-ups`);
        }
      } catch (err) {
        // Silent fail — polling is a best-effort fallback
      }
    };

    // Initial poll after 10s delay (let app settle)
    const initialTimeout = setTimeout(() => {
      poll();
      timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }, 10_000);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
