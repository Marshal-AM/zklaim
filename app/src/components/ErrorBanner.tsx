import { useEffect, useRef } from "react";
import { toast } from "../lib/toast";

interface ErrorBannerProps {
  message: string;
}

/** @deprecated Prefer `toast.error()` directly — kept for gradual migration. */
export function ErrorBanner({ message }: ErrorBannerProps) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (message && message !== last.current) {
      last.current = message;
      toast.error(message);
    }
  }, [message]);
  return null;
}
