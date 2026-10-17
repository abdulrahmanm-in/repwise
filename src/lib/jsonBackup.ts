import { db } from "@/db/database";
import { AppBackupPayload } from "@/types";

const ACTIVE_USER_KEY = "repwise_active_user_id";

export function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_USER_KEY);
}

export function setActiveUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) {
    localStorage.setItem(ACTIVE_USER_KEY, userId);
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export async function mergeDatabasePayload(payload: AppBackupPayload): Promise<boolean> {
  try {
    if (!payload.version || !Array.isArray(payload.workouts) || !Array.isArray(payload.sets)) {
      throw new Error("Invalid schema structure in backup file.");
    }

    const localExercises = await db.exercises.toArray();
    const userExercisesMap = new Map(localExercises.map((ex) => [ex.id, ex]));
    const remoteExercises = payload.exercises || [];

    const remoteCustomIds = new Set(remoteExercises.filter((ex) => ex.isCustom).map((ex) => ex.id));
    const localCustomIds = new Set(localExercises.filter((ex) => ex.isCustom).map((ex) => ex.id));

    const mergedExercises = [...localExercises];
    for (const remoteEx of remoteExercises) {
      const existing = mergedExercises.find((localEx) => localEx.id === remoteEx.id);
      if (existing) {
        mergedExercises[mergedExercises.indexOf(existing)] = { ...existing, ...remoteEx };
        continue;
      }

      if (localCustomIds.has(remoteEx.id) || remoteCustomIds.has(remoteEx.id)) {
        const candidate = localExercises.find((localEx) => localEx.id === remoteEx.id);
        if (candidate) {
          Object.assign(candidate, remoteEx);
          continue;
        }
      }

      mergedExercises.push(remoteEx);
    }

    const localRoutines = await db.routines.toArray();
    const localRoutineItems = await db.routineItems.toArray();
    const localWorkouts = await db.workouts.toArray();
    const localWorkoutExercises = await db.workoutExercises.toArray();
    const localSets = await db.sets.toArray();
    const localBodyWeights = await db.bodyWeights.toArray();
    const localSettings = await db.settings.toArray();

    const mergedRoutines = [...localRoutines];
    const mergedRoutineItems = [...localRoutineItems];
    const mergedWorkouts = [...localWorkouts];
    const mergedWorkoutExercises = [...localWorkoutExercises];
    const mergedSets = [...localSets];
    const mergedBodyWeights = [...localBodyWeights];
    const mergedSettings = [...localSettings];

    const remoteRoutineMap = new Map((payload.routines || []).map((routine) => [routine.id, routine]));
    for (const routine of payload.routines || []) {
      if (!mergedRoutines.some((localRoutine) => localRoutine.id === routine.id)) {
        mergedRoutines.push(routine);
      }
    }

    for (const item of payload.routineItems || []) {
      if (!mergedRoutineItems.some((localItem) => localItem.id === item.id)) {
        mergedRoutineItems.push(item);
      }
    }

    for (const workout of payload.workouts || []) {
      if (!mergedWorkouts.some((localWorkout) => localWorkout.id === workout.id)) {
        mergedWorkouts.push(workout);
      }
    }

    for (const we of payload.workoutExercises || []) {
      if (!mergedWorkoutExercises.some((localWe) => localWe.id === we.id)) {
        mergedWorkoutExercises.push(we);
      }
    }

    for (const set of payload.sets || []) {
      if (!mergedSets.some((localSet) => localSet.id === set.id)) {
        mergedSets.push(set);
      }
    }

    for (const bw of payload.bodyWeights || []) {
      if (!mergedBodyWeights.some((localBW) => localBW.id === bw.id)) {
        mergedBodyWeights.push(bw);
      }
    }

    for (const setting of payload.settings || []) {
      if (!mergedSettings.some((localSetting) => localSetting.id === setting.id)) {
        mergedSettings.push(setting);
      }
    }

    await db.transaction(
      "rw",
      [
        db.exercises,
        db.routines,
        db.routineItems,
        db.workouts,
        db.workoutExercises,
        db.sets,
        db.bodyWeights,
        db.settings,
      ],
      async () => {
        await db.exercises.clear();
        await db.routines.clear();
        await db.routineItems.clear();
        await db.workouts.clear();
        await db.workoutExercises.clear();
        await db.sets.clear();
        await db.bodyWeights.clear();
        await db.settings.clear();

        await db.exercises.bulkPut(mergedExercises);
        await db.routines.bulkPut(mergedRoutines);
        await db.routineItems.bulkPut(mergedRoutineItems);
        await db.workouts.bulkPut(mergedWorkouts);
        await db.workoutExercises.bulkPut(mergedWorkoutExercises);
        await db.sets.bulkPut(mergedSets);
        await db.bodyWeights.bulkPut(mergedBodyWeights);
        await db.settings.bulkPut(mergedSettings);
      }
    );

    return true;
  } catch (error) {
    console.error("Merge backup failed:", error);
    return false;
  }
}

export async function exportDatabaseToJSON(): Promise<string> {
  const [exercises, routines, routineItems, workouts, workoutExercises, sets, bodyWeights, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.routines.toArray(),
      db.routineItems.toArray(),
      db.workouts.toArray(),
      db.workoutExercises.toArray(),
      db.sets.toArray(),
      db.bodyWeights.toArray(),
      db.settings.toArray(),
    ]);

  const payload: AppBackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    routines,
    routineItems,
    workouts,
    workoutExercises,
    sets,
    bodyWeights,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importDatabaseFromJSON(jsonString: string): Promise<boolean> {
  try {
    const payload: AppBackupPayload = JSON.parse(jsonString);

    if (!payload.version || !Array.isArray(payload.workouts) || !Array.isArray(payload.sets)) {
      throw new Error("Invalid schema structure in backup file.");
    }

    return await mergeDatabasePayload(payload);
  } catch (error) {
    console.error("Backup restoration failed:", error);
    return false;
  }
}