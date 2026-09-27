import { db } from "@/db/database";
import { AppBackupPayload } from "@/types";

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
        await Promise.all([
          db.exercises.clear(),
          db.routines.clear(),
          db.routineItems.clear(),
          db.workouts.clear(),
          db.workoutExercises.clear(),
          db.sets.clear(),
          db.bodyWeights.clear(),
          db.settings.clear(),
        ]);

        await Promise.all([
          db.exercises.bulkAdd(payload.exercises || []),
          db.routines.bulkAdd(payload.routines || []),
          db.routineItems.bulkAdd(payload.routineItems || []),
          db.workouts.bulkAdd(payload.workouts || []),
          db.workoutExercises.bulkAdd(payload.workoutExercises || []),
          db.sets.bulkAdd(payload.sets || []),
          db.bodyWeights.bulkAdd(payload.bodyWeights || []),
          db.settings.bulkAdd(payload.settings || []),
        ]);
      }
    );

    return true;
  } catch (error) {
    console.error("Backup restoration failed:", error);
    return false;
  }
}