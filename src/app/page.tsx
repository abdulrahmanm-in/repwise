// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Flame,
  Trophy,
  Cloud,
  Dumbbell,
  RefreshCw,
  LogOut,
  Plus,
  Play,
  X,
  BookOpen,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Routine, WorkoutSet } from "@/types";
import { calculateStreaks, calculateEstimated1RM } from "@/lib/formulas";
import {
  initGoogleAuth,
  requestDriveAuth,
  getStoredAccessToken,
} from "@/lib/driveBackup";
import {
  fetchAndStoreGoogleProfile,
  getStoredUserProfile,
  pullLatestFromDrive,
  performFullLogout,
  GoogleUserProfile,
} from "@/lib/driveSync";

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userProfile, setUserProfile] = useState<GoogleUserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  const workouts = useLiveQuery(() => db.workouts.toArray(), []) || [];
  const routines = useLiveQuery(() => db.routines.toArray(), []) || [];
  const latestWeight = useLiveQuery(
    () => db.bodyWeights.orderBy("recordedAt").reverse().first(),
    []
  );

  const completedSets =
    useLiveQuery(async () => {
      const allSets = await db.sets.toArray();
      return allSets.filter((s) => Boolean(s.isCompleted));
    }, []) || [];

  const exercises = useLiveQuery(() => db.exercises.toArray(), []) || [];
  const { currentStreak } = calculateStreaks(workouts);

  useEffect(() => {
    const token = getStoredAccessToken();
    const guestMode = localStorage.getItem("repwise_guest_mode") === "true";

    if (token) {
      setIsAuthenticated(true);
      const cached = getStoredUserProfile();
      if (cached) {
        setUserProfile(cached);
      } else {
        fetchAndStoreGoogleProfile(token).then((p) => setUserProfile(p));
      }
    } else if (guestMode) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    initGoogleAuth(async (newToken: string) => {
      setIsSyncing(true);
      const profile = await fetchAndStoreGoogleProfile(newToken);
      if (profile) setUserProfile(profile);
      await pullLatestFromDrive();
      setIsSyncing(false);
      setIsAuthenticated(true);
      window.location.reload();
    });
  }, []);

  // Discard any previous incomplete/abandoned session
  const clearIncompleteWorkouts = async () => {
    const unfinished = await db.workouts.filter((w) => !w.isCompleted).toArray();
    for (const w of unfinished) {
      await db.workouts.delete(w.id);
      await db.workoutExercises.where("workoutId").equals(w.id).delete();
      await db.sets.where("workoutId").equals(w.id).delete();
    }
  };

  // Option 1: Launch Freestyle / Go with the flow
  const handleLaunchFreestyleWorkout = async () => {
    await clearIncompleteWorkouts();

    const dateFormatted = new Date().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const newId = `w_${Date.now()}`;
    await db.workouts.add({
      id: newId,
      title: `Freestyle Session • ${dateFormatted}`,
      startTime: Date.now(),
      totalVolumeKg: 0,
      isCompleted: false,
    });

    setShowStartModal(false);
    router.push("/workouts/active");
  };

  // Option 2: Launch from existing routine
  const handleLaunchRoutine = async (routine: Routine) => {
    await clearIncompleteWorkouts();

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

  if (isAuthenticated === null) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex flex-col justify-between py-6">
        <div className="space-y-8 pt-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 p-2 shadow-2xl flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Repwise Logo"
                width={52}
                height={52}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white">Repwise</h1>
              <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-mono">
                Local-First • Cloud-Synced
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl">
              <Dumbbell className="w-5 h-5 text-white shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Instant Set Logging</p>
                <p className="text-[11px] text-zinc-400">Zero latency. Offline-first gym tracker.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl">
              <Cloud className="w-5 h-5 text-white shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Google Drive Backup</p>
                <p className="text-[11px] text-zinc-400">Seamless sync across multiple devices.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-6">
          <button
            onClick={requestDriveAuth}
            className="w-full py-3.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98]"
          >
            <span>Sign In with Google</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem("repwise_guest_mode", "true");
              setIsAuthenticated(true);
            }}
            className="w-full py-2.5 bg-transparent border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-semibold transition-all"
          >
            Continue as Guest (Offline Only)
          </button>
        </div>
      </div>
    );
  }

  // PR Calculations
  const prs = exercises
    .map((ex) => {
      const exerciseSets = completedSets.filter((s) => s.exerciseId === ex.id);
      let topWeight = 0;
      let top1RM = 0;

      for (const s of exerciseSets) {
        const w = Number(s.weightKg) || 0;
        const r = Number(s.reps) || 0;
        if (w > topWeight) topWeight = w;
        const est = calculateEstimated1RM(w, r);
        if (est > top1RM) top1RM = est;
      }

      return {
        exerciseName: ex.name,
        topWeight,
        top1RM,
      };
    })
    .filter((p) => p.topWeight > 0)
    .sort((a, b) => b.topWeight - a.topWeight)
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center font-bold text-white text-sm">
            {userProfile?.given_name?.[0] || "R"}
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">
              {userProfile ? `Hey, ${userProfile.given_name || userProfile.name}` : "Dashboard"}
            </h1>
            <span className="text-[11px] text-zinc-400">Track. Overload. Repeat.</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs font-semibold text-zinc-200">
            <Flame className="w-3.5 h-3.5 text-white" />
            <span>{currentStreak} Days</span>
          </div>
          <button
            onClick={() => {
              if (confirm("Log out and clear session?")) {
                performFullLogout(false);
              }
            }}
            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 rounded-full transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Start Workout Primary Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Ready to train?
          </span>
          <h2 className="text-lg font-bold text-white mt-0.5">Start Workout</h2>
          <p className="text-xs text-zinc-400">
            Go with the flow or pick from your saved routines.
          </p>
        </div>

        <button
          onClick={() => setShowStartModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 font-bold py-3.5 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
        >
          <span>Start Workout</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Metric Counters */}
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

      {/* Recent PR Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent PRs
          </h2>
          <Trophy className="w-4 h-4 text-white" />
        </div>

        {prs.length === 0 ? (
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
            <p className="text-xs text-zinc-400">
              Completed sets with weights and reps will rank your top records here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prs.map((p) => (
              <div
                key={p.exerciseName}
                className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs"
              >
                <span className="font-semibold text-zinc-200">{p.exerciseName}</span>
                <div className="text-right font-mono">
                  <span className="font-bold text-white">{p.topWeight} kg</span>
                  <span className="text-zinc-500 ml-1.5">(1RM: {p.top1RM}kg)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Workout Selection Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[85vh] flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white">Choose Workout Type</h2>
              <button
                onClick={() => setShowStartModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Option 1: Go with the flow / Freestyle */}
            <button
              onClick={handleLaunchFreestyleWorkout}
              className="w-full flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:underline">
                    Go with the Flow
                  </h3>
                  <p className="text-xs text-zinc-400">Freestyle session without a template</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500" />
            </button>

            {/* Option 2: Saved Planned Routines */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <span className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
                Or Pick a Planned Routine ({routines.length})
              </span>

              {routines.length === 0 ? (
                <div className="p-4 border border-zinc-800/80 rounded-xl text-center text-xs text-zinc-500">
                  No routines saved yet. Create templates in the Workouts tab.
                </div>
              ) : (
                routines.map((routine) => (
                  <button
                    key={routine.id}
                    onClick={() => handleLaunchRoutine(routine)}
                    className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-300">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:underline">
                          {routine.title}
                        </h4>
                        <span className="text-[10px] text-zinc-500">Saved template</span>
                      </div>
                    </div>
                    <Play className="w-3.5 h-3.5 text-zinc-400 fill-current" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
