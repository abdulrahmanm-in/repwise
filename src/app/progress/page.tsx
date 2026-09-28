// src/app/progress/page.tsx
"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Workout, WorkoutSet, Exercise, BodyWeight, MuscleGroup } from "@/types";
import { calculateStreaks, calculateEstimated1RM } from "@/lib/formulas";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Dumbbell, Plus, TrendingUp, X } from "lucide-react";
import clsx from "clsx";

const MUSCLE_GROUPS: (MuscleGroup | "All")[] = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
];

export default function ProgressView() {
  const [activeTab, setActiveTab] = useState<
    "strength" | "volume" | "consistency" | "weight"
  >("strength");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "All">("All");
  const [inspectedExercise, setInspectedExercise] = useState<Exercise | null>(null);
  const [strengthMetric, setStrengthMetric] = useState<"1rm" | "maxWeight">("1rm");
  const [newWeight, setNewWeight] = useState("");

  const workouts = useLiveQuery<Workout[]>(() => db.workouts.toArray(), []) || [];
  const completedWorkouts = workouts
    .filter((w) => Boolean(w.isCompleted) && w.endTime)
    .sort((a, b) => (a.endTime || 0) - (b.endTime || 0));

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const completedSets =
    useLiveQuery<WorkoutSet[]>(
      async () => {
        const sets = await db.sets.toArray();
        return sets.filter((s) => Boolean(s.isCompleted));
      },
      []
    ) || [];

  const bodyWeights =
    useLiveQuery<BodyWeight[]>(() => db.bodyWeights.orderBy("recordedAt").toArray(), []) ||
    [];

  // Find set of exercise IDs that actually have logged sets
  const exercisesWithLoggedData = new Set(completedSets.map((s) => s.exerciseId));

  // Keep the filter: filter by selected muscle group AND ensure it has logged data
  const filteredActiveExercises = exercises.filter((e) => {
    const matchesMuscle =
      selectedMuscle === "All" || e.targetMuscle === selectedMuscle;
    const hasData = exercisesWithLoggedData.has(e.id);
    return matchesMuscle && hasData;
  });

  const { currentStreak, longestStreak } = calculateStreaks(workouts);

  // Progression Chart Generator for selected exercise
  const exerciseSets = inspectedExercise
    ? completedSets.filter((s) => s.exerciseId === inspectedExercise.id)
    : [];

  const exerciseProgressMap = new Map<
    string,
    { dateStr: string; maxWeight: number; max1RM: number; timestamp: number }
  >();

  exerciseSets.forEach((s) => {
    const parent = workouts.find((w) => w.id === s.workoutId);
    if (!parent || !parent.endTime) return;

    const dateKey = new Date(parent.endTime).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const est1RM = calculateEstimated1RM(Number(s.weightKg) || 0, Number(s.reps) || 0);
    const existing = exerciseProgressMap.get(dateKey);

    if (!existing) {
      exerciseProgressMap.set(dateKey, {
        dateStr: dateKey,
        maxWeight: Number(s.weightKg) || 0,
        max1RM: est1RM,
        timestamp: parent.endTime,
      });
    } else {
      if (Number(s.weightKg) > existing.maxWeight) existing.maxWeight = Number(s.weightKg);
      if (est1RM > existing.max1RM) existing.max1RM = est1RM;
    }
  });

  const exerciseChartData = Array.from(exerciseProgressMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  const volumeChartData = completedWorkouts.slice(-10).map((w) => ({
    title: w.title,
    date: new Date(w.endTime || 0).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    }),
    volume: Math.round(w.totalVolumeKg),
  }));

  const weightChartData = bodyWeights.map((b) => ({
    date: new Date(b.recordedAt).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    }),
    weight: b.weightKg,
  }));

  const handleRecordWeight = async () => {
    const val = parseFloat(newWeight);
    if (!val || isNaN(val)) return;
    await db.bodyWeights.add({
      id: `bw_${Date.now()}`,
      recordedAt: Date.now(),
      weightKg: val,
    });
    setNewWeight("");
  };

  return (
    <div className="space-y-5 pb-20">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Progress & Analytics</h1>
        <p className="text-xs text-zinc-400">Track overload curves for active exercises</p>
      </header>

      {/* Main Mode Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-[11px] font-semibold">
        {(["strength", "volume", "consistency", "weight"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "py-1.5 rounded-lg transition-all text-center capitalize",
              activeTab === tab
                ? "bg-white text-black font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* STRENGTH SECTION */}
      {activeTab === "strength" && (
        <div className="space-y-4">
          {/* Muscle Group Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setSelectedMuscle(m);
                  setInspectedExercise(null);
                }}
                className={clsx(
                  "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border",
                  selectedMuscle === m
                    ? "bg-white text-black font-bold border-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Exercise Cards */}
          <div className="space-y-2">
            {filteredActiveExercises.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
                No logged workouts for {selectedMuscle} yet. Log sets to see your progression!
              </div>
            ) : (
              filteredActiveExercises.map((ex) => {
                const setsForEx = completedSets.filter((s) => s.exerciseId === ex.id);
                let bestWeight = 0;
                let best1RM = 0;

                setsForEx.forEach((s) => {
                  const w = Number(s.weightKg) || 0;
                  const r = Number(s.reps) || 0;
                  if (w > bestWeight) bestWeight = w;
                  const e1rm = calculateEstimated1RM(w, r);
                  if (e1rm > best1RM) best1RM = e1rm;
                });

                return (
                  <div
                    key={ex.id}
                    onClick={() => setInspectedExercise(ex)}
                    className="p-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{ex.name}</h4>
                      <span className="text-[10px] text-zinc-500">
                        {ex.targetMuscle} • {ex.equipment} • {setsForEx.length} sets
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-white">
                          {bestWeight} kg
                        </span>
                        <span className="block text-[10px] text-zinc-500">
                          1RM: {best1RM}kg
                        </span>
                      </div>
                      <TrendingUp className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Inspect Exercise Strength Chart Modal */}
          {inspectedExercise && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[85vh] flex flex-col space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">{inspectedExercise.name}</h3>
                    <span className="text-[10px] text-zinc-400">
                      {inspectedExercise.targetMuscle} • {inspectedExercise.equipment}
                    </span>
                  </div>
                  <button
                    onClick={() => setInspectedExercise(null)}
                    className="text-zinc-400 hover:text-white p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white">Metric</span>
                  <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-[10px]">
                    <button
                      onClick={() => setStrengthMetric("1rm")}
                      className={clsx(
                        "px-2 py-1 rounded font-medium",
                        strengthMetric === "1rm"
                          ? "bg-white text-black font-bold"
                          : "text-zinc-400"
                      )}
                    >
                      Est. 1RM
                    </button>
                    <button
                      onClick={() => setStrengthMetric("maxWeight")}
                      className={clsx(
                        "px-2 py-1 rounded font-medium",
                        strengthMetric === "maxWeight"
                          ? "bg-white text-black font-bold"
                          : "text-zinc-400"
                      )}
                    >
                      Max Weight
                    </button>
                  </div>
                </div>

                {exerciseChartData.length < 2 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl text-center px-4">
                    Complete at least 2 separate sessions of {inspectedExercise.name} to plot the curve.
                  </div>
                ) : (
                  <div className="h-52 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={exerciseChartData}>
                        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="dateStr" stroke="#71717a" fontSize={10} tickLine={false} />
                        <YAxis
                          stroke="#71717a"
                          fontSize={10}
                          domain={["dataMin - 5", "dataMax + 5"]}
                          tickLine={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#18181b",
                            borderColor: "#27272a",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey={strengthMetric === "1rm" ? "max1RM" : "maxWeight"}
                          stroke="#ffffff"
                          strokeWidth={2}
                          dot={{ r: 4, fill: "#ffffff" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VOLUME SECTION */}
      {activeTab === "volume" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-white">Session Volume (kg)</span>
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          {volumeChartData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              No completed sessions yet.
            </div>
          ) : (
            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeChartData}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="volume" fill="#ffffff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* CONSISTENCY SECTION */}
      {activeTab === "consistency" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold text-zinc-300">Active Streak</span>
            <span className="text-xs text-zinc-500 font-mono">Best: {longestStreak} Days</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{currentStreak}</span>
            <span className="text-xs text-zinc-400">Consecutive Days</span>
          </div>
        </div>
      )}

      {/* WEIGHT SECTION */}
      {activeTab === "weight" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-white">Body Weight Log</span>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="kg"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-center outline-none text-white"
              />
              <button
                onClick={handleRecordWeight}
                className="bg-white text-black p-1.5 rounded-lg font-bold hover:bg-zinc-200"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </div>

          {weightChartData.length < 2 ? (
            <div className="h-44 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800 rounded-xl">
              Log at least 2 weigh-ins to plot trend lines.
            </div>
          ) : (
            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#ffffff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
