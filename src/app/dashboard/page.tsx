// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Trophy, LogOut, Dumbbell, Play, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Workout, Exercise, WorkoutSet, Routine } from "@/types";
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
  const [showStartModal, setShowStartModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getStoredAccessToken();
    const guestMode = localStorage.getItem("repwise_guest_mode") === "true";

    if (!token && !guestMode) {
      router.replace("/");
      return;
    }

    const cached = getStoredUserProfile();
    if (cached) setUserProfile(cached);
  }, [router]);

  const workouts = useLiveQuery<Workout[]>(() => db.workouts.toArray(), []) || [];
  const routines = useLiveQuery<Routine[]>(() => db.routines.toArray(), []) || [];
  const latestWeight = useLiveQuery(
    () => db.bodyWeights.orderBy("recordedAt").reverse().first(),
    []
  );
  const completedSets =
    useLiveQuery<WorkoutSet[]>(
      () => db.sets.filter((s) => Boolean(s.isCompleted)).toArray(),
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

  const startRoutine = async (routine: Routine) => {
    const unfinished = await db.workouts.filter((w) => !w.isCompleted).toArray();
    for (const w of unfinished) {
      await db.workouts.delete(w.id);
      await db.workoutExercises.where("workoutId").equals(w.id).delete();
      await db.sets.where("workoutId").equals(w.id).delete();
    }

    const routineItems = await db.routineItems
      .where("routineId")
      .equals(routine.id)
      .sortBy("orderIndex");

    const workoutId = `w_${Date.now()}`;
    await db.workouts.add({
      id: workoutId,
      routineId: routine.id,
      title: routine.title,
      startTime: Date.now(),
      totalVolumeKg: 0,
      isCompleted: false,
    });

    const completedWorkouts = await db.workouts
      .filter((w) => Boolean(w.isCompleted) && Boolean(w.endTime))
      .toArray();
    completedWorkouts.sort((a, b) => (b.endTime || 0) - (a.endTime || 0));

    for (const item of routineItems) {
      const weId = `we_${Date.now()}_${item.exerciseId}`;
      await db.workoutExercises.add({
        id: weId,
        workoutId,
        exerciseId: item.exerciseId,
        orderIndex: item.orderIndex,
      });

      let previousSets: WorkoutSet[] = [];
      for (const cw of completedWorkouts) {
        const found = await db.sets
          .where("workoutId")
          .equals(cw.id)
          .filter((s) => s.exerciseId === item.exerciseId && Boolean(s.isCompleted))
          .sortBy("setIndex");
        if (found.length > 0) {
          previousSets = found;
          break;
        }
      }

      const setsCount = item.targetSets || 3;
      for (let s = 1; s <= setsCount; s++) {
        const ghostSet = previousSets[s - 1] || previousSets[0];
        const initialWeight = ghostSet ? ghostSet.weightKg : item.targetWeightKg || 0;
        const initialReps = ghostSet ? ghostSet.reps : item.targetReps || 10;

        await db.sets.add({
          id: `s_${Date.now()}_${item.exerciseId}_${s}`,
          workoutExerciseId: weId,
          workoutId,
          exerciseId: item.exerciseId,
          setIndex: s,
          setType: "normal",
          weightKg: initialWeight,
          reps: initialReps,
          isCompleted: false,
        });
      }
    }

    setShowStartModal(false);
    router.push("/workouts/active");
  };

  return (
    <div className="space-y-6 pb-28">
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

        <button
          onClick={() => setShowStartModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
        >
          <span>Start Workout</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
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
            {workouts.filter((w) => Boolean(w.isCompleted)).length}
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

      {/* React Portal: Mounts directly to <body> to bypass any layout or navbar z-index stacking */}
      {mounted &&
        showStartModal &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 select-none">
            <div
              className="absolute inset-0"
              onClick={() => setShowStartModal(false)}
            />

            <div className="relative z-10 w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[80vh] flex flex-col shadow-2xl mb-[4.5rem]">
              <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3 shrink-0" />

              <div className="flex justify-between items-center pb-3 border-b border-zinc-800 shrink-0">
                <h2 className="text-base font-bold text-white">Choose Workout Routine</h2>
                <button
                  onClick={() => setShowStartModal(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2.5 py-3 flex-1 pr-1 pb-4">
                <Link
                  href="/workouts/active"
                  onClick={() => setShowStartModal(false)}
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-4 rounded-2xl flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white">
                      <Dumbbell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">Go with the Flow</h3>
                      <p className="text-xs text-zinc-500">Freestyle session without a template</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500" />
                </Link>

                <div className="pt-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                    Or Pick a Planned Routine ({routines.length})
                  </span>
                </div>

                {routines.map((routine) => (
                  <div
                    key={routine.id}
                    onClick={() => startRoutine(routine)}
                    className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-colors active:scale-[0.99]"
                  >
                    <div>
                      <h4 className="font-semibold text-white text-sm">{routine.title}</h4>
                      <span className="text-xs text-zinc-500">Saved template</span>
                    </div>
                    <div className="p-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl transition-colors">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}