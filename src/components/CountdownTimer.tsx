"use client";

import { useEffect } from "react";
import { formatTimeRemaining, useCountdown } from "@/store/useCountdown";

export function CountdownTimer({ rfqId, deadline }: { rfqId: string; deadline: string }) {
  const register = useCountdown((s) => s.register);
  const tick = useCountdown((s) => s.tick);
  const now = useCountdown((s) => s.now);

  useEffect(() => {
    register(rfqId, deadline);
  }, [rfqId, deadline, register]);

  useEffect(() => {
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tick]);

  return (
    <span className="font-medium text-slate-200">{formatTimeRemaining(deadline, now)}</span>
  );
}
