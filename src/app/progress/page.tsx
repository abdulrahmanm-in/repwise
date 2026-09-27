// src/app/progress/page.tsx
"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { Workout, WorkoutSet, Exercise, BodyWeight } from "@/types";
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
import {
  Flame,
  Calendar,
  TrendingUp,
  Dumbbell,
  Plus,
  Scale,
  Award,
} from "lucide-react";
import clsx from "clsx";

export default function ProgressView() {
  const [activeTab, setActiveTab] = useState<"strength" | "volume" | "consistency" | "weight">("strength");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [strengthMetric, setStrengthMetric] = useState<"1rm" | "maxWeight">("1rm");
  const [newWeight, setNewWeight] = useState("");

  const workouts = useLiveQuery<Workout[]>(() => db.workouts.toArray(), []) || [];
  const completedWorkouts = workouts
    .filter((w) => w.isCompleted && w.endTime)
    .sort((a, b) => (a.endTime || 0) - (b.endTime || 0));

  const exercises = useLiveQuery<Exercise[]>(() => db.exercises.toArray(), []) || [];
  const completedSets =
    useLiveQuery<WorkoutSet[]>(
      () => db.sets.where("isCompleted").equals(1).toArray(),
      []
    ) || [];

  const bodyWeights =
    useLiveQuery<BodyWeight[]>(
      () => db.bodyWeights.orderBy("recordedAt").toArray(),
      []
    ) || [];

  // Default selected exercise to the first available exercise
  const currentExerciseId = selectedExerciseId || (exercises[0]?.id ?? "");

  // ----------------------------------------------------
  // 1. Consistency & Streak Calculations
  // ----------------------------------------------------
  const { currentStreak, longestStreak } = calculateStreaks(workouts);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday start
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const workoutsThisWeek = completedWorkouts.filter(
    (w) => (w.endTime || 0) >= startOfWeek.getTime()
  ).length;

  const workoutsThisMonth = completedWorkouts.filter(
    (w) => (w.endTime || 0) >= startOfMonth.getTime()
  ).length;

  // Generate last 7 days heat strip
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);

    const isDone = completedWorkouts.some((w) => {
      const wDate = new Date(w.endTime || 0);
      wDate.setHours(0, 0, 0, 0);
      return wDate.getTime() === d.getTime();
    });

    return {
      dayLabel: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      dateNumber: d.getDate(),
      isDone,
    };
  });

  // ----------------------------------------------------
  // 2. Exercise Strength Progression (1RM / Max Weight)
  // ----------------------------------------------------
  const exerciseSets = completedSets.filter(
    (s) => s.exerciseId === currentExerciseId
  );

  // Group performance by workout session date
  const exerciseProgressMap = new Map<
    string,
    { dateStr: string; maxWeight: number; max1RM: number; timestamp: number }
  >();

  exerciseSets.forEach((s) => {
    const parentWorkout = workouts.find((w) => w.id === s.workoutId);
    if (!parentWorkout || !parentWorkout.endTime) return;

    const workoutDate = new Date(parentWorkout.endTime);
    const dateKey = workoutDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const est1RM = calculateEstimated1RM(s.weightKg, s.reps);
    const existing = exerciseProgressMap.get(dateKey);

    if (!existing) {
      exerciseProgressMap.set(dateKey, {
        dateStr: dateKey,
        maxWeight: s.weightKg,
        max1RM: est1RM,
        timestamp: parentWorkout.endTime,
      });
    } else {
      if (s.weightKg > existing.maxWeight) existing.maxWeight = s.weightKg;
      if (est1RM > existing.max1RM) existing.max1RM = est1RM;
    }
  });

  const exerciseChartData = Array.from(exerciseProgressMap.values()).sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // ----------------------------------------------------
  // 3. Overall Workout Volume Progression
  // ----------------------------------------------------
  const volumeChartData = completedWorkouts.slice(-10).map((w) => ({
    title: w.title,
    date: new Date(w.endTime || 0).toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric",
    }),
    volume: Math.round(w.totalVolumeKg),
  }));

  // ----------------------------------------------------
  // 4. Body Weight Handlers
  // ----------------------------------------------------
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
    <div className="space-y-5 pb-16">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-xl font-bold text-white tracking-tight">Progress & Analytics</h1>
        <p className="text-xs text-zinc-400">Track overload, habit consistency, and milestones</p>
      </header>

      {/* Metric Filter Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab("strength")}
          className={clsx(
            "py-1.5 rounded-lg transition-all text-center",
            activeTab === "strength" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Strength
        </button>
        <button
          onClick={() => setActiveTab("volume")}
          className={clsx(
            "py-1.5 rounded-lg transition-all text-center",
            activeTab === "volume" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Volume
        </button>
        <button
          onClick={() => setActiveTab("consistency")}
          className={clsx(
            "py-1.5 rounded-lg transition-all text-center",
            activeTab === "consistency" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Habit
        </button>
        <button
          onClick={() => setActiveTab("weight")}
          className={clsx(
            "py-1.5 rounded-lg transition-all text-center",
            activeTab === "weight" ? "bg-white text-black font-bold" : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          Weight
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STRENGTH PROGRESSION PER EXERCISE                  */}
      {/* ========================================================= */}
      {activeTab === "strength" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Select Exercise
              </label>
              <select
                value={currentExerciseId}
                onChange={(e) => setSelectedExerciseId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.targetMuscle})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-semibold text-white">Progression Curve</span>
              <div className="flex bg-zinc-800 p-0.5 rounded-lg border border-zinc-700 text-[10px]">
                <button
                  onClick={() => setStrengthMetric("1rm")}
                  className={clsx(
                    "px-2 py-1 rounded font-medium",
                    strengthMetric === "1rm" ? "bg-white text-black" : "text-zinc-400"
                  )}
                >
                  Est. 1RM
                </button>
                <button
                  onClick={() => setStrengthMetric("maxWeight")}
                  className={clsx(
                    "px-2 py-1 rounded font-medium",
                    strengthMetric === "maxWeight" ? "bg-white text-black" : "text-zinc-400"
                  )}
                >
                  Max Weight
                </button>
              </div>
            </div>

            {exerciseChartData.length < 2 ? (
              <div className="h-48 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl text-center px-4">
                Complete at least 2 sessions of this exercise to chart progressive overload.
              </div>
            ) : (
              <div className="h-48 w-full pt-2">
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
                      name={strengthMetric === "1rm" ? "1RM (kg)" : "Max Weight (kg)"}
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

      {/* ========================================================= */}
      {/* TAB 2: TRAINING VOLUME PER WORKOUT                       */}
      {/* ========================================================= */}
      {activeTab === "volume" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white">Total Volume / Session</span>
                <p className="text-[11px] text-zinc-400">Sum of (Weight × Reps) per completed workout</p>
              </div>
              <Dumbbell className="w-4 h-4 text-white" />
            </div>

            {volumeChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl">
                No completed workouts logged yet.
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
                    <Bar dataKey="volume" name="Volume (kg)" fill="#ffffff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CONSISTENCY & HABIT TRACKING                      */}
      {/* ========================================================= */}
      {activeTab === "consistency" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Main Streak Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-white" />
                <span className="text-xs uppercase font-bold text-zinc-300 tracking-wider">
                  Consistency Status
                </span>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                Best: {longestStreak} Days
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{currentStreak}</span>
              <span className="text-xs text-zinc-400 font-medium">Consecutive Active Days</span>
            </div>

            {/* Rolling 7-Day Heat Strip */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-semibold text-zinc-400">
                Last 7 Days Activity
              </span>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {last7Days.map((d, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="text-[10px] text-zinc-500 block">{d.dayLabel}</span>
                    <div
                      className={clsx(
                        "h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-colors",
                        d.isDone
                          ? "bg-white text-black shadow-md"
                          : "bg-zinc-800/80 border border-zinc-700/60 text-zinc-500"
                      )}
                    >
                      {d.dateNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Aggregated Totals Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">This Week</span>
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {workoutsThisWeek} <span className="text-xs font-normal text-zinc-500">sessions</span>
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Award className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">This Month</span>
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {workoutsThisMonth} <span className="text-xs font-normal text-zinc-500">sessions</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: BODY WEIGHT LOGGING & CHART                       */}
      {/* ========================================================= */}
      {activeTab === "weight" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-white" />
                <span className="text-xs font-semibold text-white">Log Weight</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="kg"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-white text-white"
                />
                <button
                  onClick={handleRecordWeight}
                  className="bg-white text-black p-1.5 rounded-lg hover:bg-zinc-200 font-bold"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>
            </div>

            {weightChartData.length < 2 ? (
              <div className="h-44 flex items-center justify-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl">
                Log at least 2 weigh-ins to plot trend lines.
              </div>
            ) : (
              <div className="h-44 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartData}>
                    <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} />
                    <YAxis
                      stroke="#71717a"
                      fontSize={10}
                      domain={["dataMin - 1", "dataMax + 1"]}
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
                      dataKey="weight"
                      name="Weight (kg)"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#ffffff" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}