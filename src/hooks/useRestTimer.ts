"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useRestTimer() {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState<number>(90);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAlert = useCallback(async () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch {
      // AudioContext policy bypass
    }

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Rest Finished!", {
          body: "Time for your next set.",
          icon: "/icon-192.png",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (isRunning && secondsRemaining !== null) {
      if (secondsRemaining <= 0) {
        triggerAlert();
        setIsRunning(false);
        setSecondsRemaining(null);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        timerRef.current = setInterval(() => {
          setSecondsRemaining((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, secondsRemaining, triggerAlert]);

  const startTimer = useCallback((durationSeconds?: number) => {
    const time = durationSeconds ?? totalSeconds;
    setTotalSeconds(time);
    setSecondsRemaining(time);
    setIsRunning(true);
  }, [totalSeconds]);

  const pauseTimer = useCallback(() => setIsRunning(false), []);
  const resumeTimer = useCallback(() => setIsRunning(true), []);
  const skipTimer = useCallback(() => {
    setIsRunning(false);
    setSecondsRemaining(null);
  }, []);
  const addThirtySeconds = useCallback(() => {
    setSecondsRemaining((prev) => (prev !== null ? prev + 30 : 30));
  }, []);

  return {
    secondsRemaining,
    totalSeconds,
    isRunning,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipTimer,
    addThirtySeconds,
  };
}