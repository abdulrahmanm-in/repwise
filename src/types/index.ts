export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Legs"
  | "Shoulders"
  | "Arms"
  | "Core"
  | "Full Body"
  | "Cardio";

export type EquipmentType =
  | "Barbell"
  | "Dumbbell"
  | "Cable"
  | "Machine"
  | "Bodyweight"
  | "Kettlebell"
  | "Smith Machine"
  | "Other";

export type SetType = "normal" | "warmup" | "dropset" | "failure" | "amrap";

export interface Exercise {
  id: string;
  name: string;
  targetMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: EquipmentType;
  instructions?: string;
  isCustom: boolean;
  isArchived: boolean;
}

export interface RoutineItem {
  id: string;
  routineId: string;
  exerciseId: string;
  orderIndex: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg?: number;
  restSeconds: number;
}

export interface Routine {
  id: string;
  title: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workout {
  id: string;
  routineId?: string;
  title: string;
  startTime: number;
  endTime?: number;
  totalVolumeKg: number;
  notes?: string;
  isCompleted: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  notes?: string;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  setType: SetType;
  weightKg: number;
  reps: number;
  isCompleted: boolean;
  notes?: string;
  completedAt?: number;
}

export interface BodyWeight {
  id: string;
  recordedAt: number;
  weightKg: number;
  notes?: string;
}

export interface UserSettings {
  id: string;
  weightUnit: "kg" | "lbs";
  defaultRestTimeSeconds: number;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  theme: "dark";
  googleDriveLinked: boolean;
  lastBackupAt?: number;
}

export interface AppBackupPayload {
  version: number;
  exportedAt: string;
  exercises: Exercise[];
  routines: Routine[];
  routineItems: RoutineItem[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  sets: WorkoutSet[];
  bodyWeights: BodyWeight[];
  settings: UserSettings[];
}