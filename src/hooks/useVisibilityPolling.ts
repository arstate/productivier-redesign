import { useEffect, useRef } from "react";

/**
 * Runs an interval callback only when the page is visible and enabled.
 * Automatically triggers once when returning to focus so UI stays fresh
 * without draining battery, CPU, or memory in background tabs.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => {
        if (typeof document === "undefined" || !document.hidden) {
          void savedCallback.current();
        }
      }, intervalMs);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        void savedCallback.current();
        start();
      }
    };

    if (typeof document === "undefined" || !document.hidden) {
      start();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
