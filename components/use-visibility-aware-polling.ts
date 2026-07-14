"use client";

import { useCallback, useEffect, useRef } from "react";

type VisibilityAwarePollingOptions = {
  enabled: boolean;
  intervalMs: number;
  refreshKey?: string | number | boolean | null;
  task: (signal: AbortSignal) => Promise<void> | void;
};

/**
 * Runs a best-effort polling task only while this document is both visible and
 * online. The next request is scheduled after the current one settles, so a
 * slow network can never create overlapping polling requests.
 */
export function useVisibilityAwarePolling({
  enabled,
  intervalMs,
  refreshKey,
  task,
}: VisibilityAwarePollingOptions) {
  const enabledRef = useRef(enabled);
  const intervalRef = useRef(intervalMs);
  const taskRef = useRef(task);
  const triggerRef = useRef<(() => void) | null>(null);

  enabledRef.current = enabled;
  intervalRef.current = intervalMs;
  taskRef.current = task;

  const refreshNow = useCallback(() => {
    triggerRef.current?.();
  }, []);

  useEffect(() => {
    let disposed = false;
    let pageIsHiding = false;
    let inFlight = false;
    let rerunRequested = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    function canPoll() {
      return !disposed
        && !pageIsHiding
        && enabledRef.current
        && document.visibilityState === "visible"
        && navigator.onLine !== false;
    }

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function stop() {
      clearTimer();
      rerunRequested = false;
      controller?.abort();
    }

    function schedule(delay: number) {
      clearTimer();
      if (!canPoll()) return;
      timer = window.setTimeout(() => {
        timer = null;
        void run();
      }, delay);
    }

    async function run() {
      if (!canPoll()) return;
      if (inFlight) {
        rerunRequested = true;
        return;
      }

      inFlight = true;
      const requestController = new AbortController();
      controller = requestController;

      try {
        await taskRef.current(requestController.signal);
      } catch {
        // Polling is best-effort. This also consumes fetch AbortError on pause.
      } finally {
        if (controller === requestController) controller = null;
        inFlight = false;
        if (!canPoll()) return;

        const shouldRerun = rerunRequested;
        rerunRequested = false;
        schedule(shouldRerun ? 0 : intervalRef.current);
      }
    }

    function trigger() {
      clearTimer();
      if (!canPoll()) {
        stop();
        return;
      }
      if (inFlight) {
        rerunRequested = true;
        controller?.abort();
        return;
      }
      void run();
    }

    function resume() {
      pageIsHiding = false;
      trigger();
    }

    function pause() {
      stop();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") resume();
      else pause();
    }

    function onPageHide() {
      pageIsHiding = true;
      pause();
    }

    triggerRef.current = trigger;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", resume);
    window.addEventListener("offline", pause);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", resume);

    return () => {
      disposed = true;
      triggerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", pause);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", resume);
      stop();
    };
  }, []);

  useEffect(() => {
    triggerRef.current?.();
  }, [enabled, intervalMs, refreshKey]);

  return refreshNow;
}
