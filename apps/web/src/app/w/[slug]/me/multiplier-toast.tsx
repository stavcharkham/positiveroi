"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Fires the celebration toast exactly once when the server detected a fresh
 * Multiplier award during this render (badge row did not exist, hours now
 * qualify). Renders nothing.
 */
function MultiplierToast({ newlyAwarded }: { newlyAwarded: boolean }) {
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (!newlyAwarded || fired.current) return;
    fired.current = true;
    toast.success("You're a Multiplier", {
      description:
        "180 saved hours in 30 days — a full-time job's worth of saved time. The badge is permanent.",
      duration: 8000,
    });
  }, [newlyAwarded]);

  return null;
}

export { MultiplierToast };
