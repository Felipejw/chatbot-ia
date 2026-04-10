import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export function useCampaignPoller() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke("execute-campaign", {
          body: { time: new Date().toISOString(), source: "poller" },
        });

        if (error) {
          console.warn("[CampaignPoller] Error:", error.message);
        } else if (data?.results?.length > 0) {
          const totalSent = data.results.reduce((acc: number, r: any) => acc + (r.sent || 0), 0);
          if (totalSent > 0) {
            console.log(`[CampaignPoller] Sent ${totalSent} messages across ${data.results.length} campaigns`);
          }
        }
      } catch (err) {
        // Silent fail — polling is best-effort
      }
    };

    // Initial poll after 15s delay
    const initialTimeout = setTimeout(() => {
      poll();
      timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    }, 15_000);

    return () => {
      clearTimeout(initialTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
}
