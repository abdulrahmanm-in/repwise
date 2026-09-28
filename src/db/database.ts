import Dexie, { type EntityTable } from "dexie";
import {
  Exercise,
  Routine,
  RoutineItem,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  BodyWeight,
  UserSettings,
} from "@/types";
import { BUILTIN_EXERCISES } from "./seedData";

class RepwiseDB extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  routines!: EntityTable<Routine, "id">;
  routineItems!: EntityTable<RoutineItem, "id">;
  workouts!: EntityTable<Workout, "id">;
  workoutExercises!: EntityTable<WorkoutExercise, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  bodyWeights!: EntityTable<BodyWeight, "id">;
  settings!: EntityTable<UserSettings, "id">;

  constructor() {
    super("RepwiseDatabase");

    this.version(1).stores({
      exercises: "id, name, targetMuscle, equipment, isCustom, isArchived",
      routines: "id, title, createdAt, updatedAt",
      routineItems: "id, routineId, exerciseId, orderIndex",
      workouts: "id, routineId, startTime, endTime, isCompleted",
      workoutExercises: "id, workoutId, exerciseId, orderIndex",
      sets: "id, workoutExerciseId, workoutId, exerciseId, isCompleted, [exerciseId+isCompleted]",
      bodyWeights: "id, recordedAt",
      settings: "id",
    });

    this.on("populate", async () => {
      await this.exercises.bulkAdd(BUILTIN_EXERCISES);
      await this.settings.add({
        id: "current",
        weightUnit: "kg",
        defaultRestTimeSeconds: 90,
        soundEnabled: true,
        vibrateEnabled: true,
        theme: "dark",
        googleDriveLinked: false,
      });
    });
  }
}

export const db = new RepwiseDB();

export async function ensureExercisesSeeded() {
  try {
    // 1. Seed or update built-in exercises in a single atomic transaction
    const existingIds = new Set(await db.exercises.toCollection().primaryKeys());
    const missingExercises = BUILTIN_EXERCISES.filter(
      (ex) => !existingIds.has(ex.id)
    );

    if (missingExercises.length > 0) {
      await db.exercises.bulkPut(missingExercises);
    }

    // 2. Guarantee default user settings record exists
    const settingsExist = await db.settings.get("current");
    if (!settingsExist) {
      await db.settings.put({
        id: "current",
        weightUnit: "kg",
        defaultRestTimeSeconds: 90,
        soundEnabled: true,
        vibrateEnabled: true,
        theme: "dark",
        googleDriveLinked: false,
      });
    }
  } catch (error) {
    console.error("Failed to verify database seeds:", error);
  }
}
