// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Trophy, LogOut } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Workout, Exercise, WorkoutSet } from "@/types";
import { calculateStreaks, calculateEstimated1RM } from "@/lib/formulas";
import { getStoredAccessToken } from "@/lib/driveBackup";
import {
  getStoredUserProfile,
  performFullLogout,
  GoogleUserProfile,
} from "@/lib/driveSync";

export default function Dashboard() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    const guestMode = localStorage.getItem("repwise_guest_mode") === "true";

    // Route unauthenticated visitors back to the home login page
    if (!token && !guestMode) {
      router.replace("/");
      return;
    }

    const cached = getStoredUserProfile();
    if (cached) setUserProfile(cached);
  }, [router]);

  const workouts = useLiveQuery<Workout[]>(() => db.workouts.toArray(), []) || [];
  const latestWeight = useLiveQuery(
    () => db.bodyWeights.orderBy("recordedAt").reverse().first(),
    []
  );
  const completedSets =
    useLiveQuery<WorkoutSet[]>(
      () => db.sets.where("isCompleted").equals(1).toArray(),
      []
    ) || [];
  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];

  const { currentStreak } = calculateStreaks(workouts);

  const prs = exercises
    .map((ex) => {
      const exerciseSets = completedSets.filter((s) => s.exerciseId === ex.id);
      let topWeight = 0;
      let top1RM = 0;

      for (const s of exerciseSets) {
        if (s.weightKg > topWeight) topWeight = s.weightKg;
        const est = calculateEstimated1RM(s.weightKg, s.reps);
        if (est > top1RM) top1RM = est;
      }

      return {
        exerciseName: ex.name,
        topWeight,
        top1RM,
      };
    })
    .filter((p) => p.topWeight > 0)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-2.5">
          {userProfile?.picture ? (
            <Image
              src={userProfile.picture}
              alt={userProfile.name}
              width={32}
              height={32}
              className="rounded-full border border-zinc-800"
            />
          ) : (
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Repwise Logo"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              {userProfile ? `Hey, ${userProfile.given_name || userProfile.name}` : "Dashboard"}
            </h1>
            <span className="text-[11px] text-zinc-400">Track. Overload. Repeat.</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs font-medium text-zinc-200">
            <Flame className="w-3.5 h-3.5 text-white" />
            <span>{currentStreak} Days</span>
          </div>

          <button
            onClick={() => {
              if (confirm("Are you sure you want to log out? Local data on this device will be cleared.")) {
                performFullLogout(true);
              }
            }}
            title="Log Out"
            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-rose-400 rounded-full transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Start Workout Primary Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Today
          </span>
          <h2 className="text-lg font-bold text-white mt-0.5">Quick Start Session</h2>
          <p className="text-xs text-zinc-400">Log an empty workout or start from your routines.</p>
        </div>

        <Link
          href="/workouts/active"
          className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
        >
          <span>Start Empty Workout</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">Body Weight</span>
          <p className="text-xl font-bold font-mono mt-1 text-white">
            {latestWeight ? `${latestWeight.weightKg} kg` : "—"}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <span className="text-xs text-zinc-400 font-medium">Workouts Done</span>
          <p className="text-xl font-bold font-mono mt-1 text-white">
            {workouts.filter((w) => w.isCompleted).length}
          </p>
        </div>
      </div>

      {/* Personal Records */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent PRs
          </h2>
          <Trophy className="w-4 h-4 text-zinc-400" />
        </div>

        {prs.length === 0 ? (
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
            <p className="text-xs text-zinc-500">Completed sets will rank your top records here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {prs.map((p) => (
              <div
                key={p.exerciseName}
                className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs"
              >
                <span className="font-medium text-zinc-200">{p.exerciseName}</span>
                <div className="text-right font-mono">
                  <span className="font-bold text-white">{p.topWeight} kg</span>
                  <span className="text-zinc-500 ml-1.5">(1RM: {p.top1RM}kg)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}