import { WorkoutSet, Workout } from "@/types";

export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  const clampedReps = Math.min(reps, 15);
  const result = weightKg * (1 + clampedReps / 30);
  return Math.round(result * 10) / 10;
}

export function calculateWorkoutVolume(sets: WorkoutSet[]): number {
  return sets
    .filter((s) => s.isCompleted && s.setType !== "warmup")
    .reduce((acc, curr) => acc + curr.weightKg * curr.reps, 0);
}

export function calculateStreaks(workouts: Workout[]): {
  currentStreak: number;
  longestStreak: number;
} {
  const completed = workouts
    .filter((w) => w.isCompleted && w.endTime)
    .map((w) => {
      const d = new Date(w.endTime!);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    });

  if (completed.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const uniqueDays = Array.from(new Set(completed)).sort((a, b) => b - a);
  const MS_PER_DAY = 86400000;
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const yesterdayStart = todayStart - MS_PER_DAY;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const isStreakAlive =
    uniqueDays[0] === todayStart || uniqueDays[0] === yesterdayStart;

  if (isStreakAlive) {
    let checkDay = uniqueDays[0];
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i] === checkDay - MS_PER_DAY) {
        currentStreak++;
        checkDay = uniqueDays[i];
      } else {
        break;
      }
    }
  }

  const chronological = [...uniqueDays].sort((a, b) => a - b);
  for (let i = 0; i < chronological.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      if (chronological[i] === chronological[i - 1] + MS_PER_DAY) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }

  return { currentStreak, longestStreak };
}