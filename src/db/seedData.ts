// src/db/seedData.ts
import { Exercise } from "@/types";

export const BUILTIN_EXERCISES: Exercise[] = [
  // CHEST
  { id: "ex_bench_press", name: "Barbell Bench Press", targetMuscle: "Chest", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_incline_bb_press", name: "Incline Barbell Press", targetMuscle: "Chest", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_db_bench_press", name: "Dumbbell Bench Press", targetMuscle: "Chest", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_incline_db_press", name: "Incline Dumbbell Press", targetMuscle: "Chest", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_chest_fly_machine", name: "Pec Deck / Chest Fly", targetMuscle: "Chest", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_cable_crossover", name: "Cable Crossover / Fly", targetMuscle: "Chest", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_dips_chest", name: "Chest Dips", targetMuscle: "Chest", equipment: "Bodyweight", isCustom: false, isArchived: false },
  { id: "ex_pushups", name: "Push Up", targetMuscle: "Chest", equipment: "Bodyweight", isCustom: false, isArchived: false },

  // BACK
  { id: "ex_conventional_deadlift", name: "Conventional Deadlift", targetMuscle: "Back", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_lat_pulldown", name: "Lat Pulldown", targetMuscle: "Back", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_barbell_row", name: "Barbell Bent Over Row", targetMuscle: "Back", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_seated_cable_row", name: "Seated Cable Row", targetMuscle: "Back", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_db_single_arm_row", name: "Dumbbell Row", targetMuscle: "Back", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_pullups", name: "Pull Up", targetMuscle: "Back", equipment: "Bodyweight", isCustom: false, isArchived: false },
  { id: "ex_chinups", name: "Chin Up", targetMuscle: "Back", equipment: "Bodyweight", isCustom: false, isArchived: false },
  { id: "ex_tbar_row", name: "T-Bar Row", targetMuscle: "Back", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_facepull", name: "Cable Face Pull", targetMuscle: "Back", equipment: "Cable", isCustom: false, isArchived: false },

  // SHOULDERS
  { id: "ex_overhead_press", name: "Standing Overhead Press (OHP)", targetMuscle: "Shoulders", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_seated_db_press", name: "Dumbbell Shoulder Press", targetMuscle: "Shoulders", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_lateral_raise_db", name: "Dumbbell Lateral Raise", targetMuscle: "Shoulders", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_cable_lateral_raise", name: "Cable Lateral Raise", targetMuscle: "Shoulders", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_front_raise", name: "Dumbbell Front Raise", targetMuscle: "Shoulders", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_rear_delt_fly", name: "Rear Delt Fly", targetMuscle: "Shoulders", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_shrugs", name: "Dumbbell / Barbell Shrug", targetMuscle: "Shoulders", equipment: "Dumbbell", isCustom: false, isArchived: false },

  // LEGS
  { id: "ex_barbell_squat", name: "Barbell Back Squat", targetMuscle: "Legs", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_front_squat", name: "Front Squat", targetMuscle: "Legs", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_leg_press", name: "Leg Press", targetMuscle: "Legs", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_romanian_deadlift", name: "Romanian Deadlift (RDL)", targetMuscle: "Legs", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_bulgarian_split_squat", name: "Bulgarian Split Squat", targetMuscle: "Legs", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_leg_extension", name: "Leg Extension", targetMuscle: "Legs", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_leg_curl", name: "Hamstring Leg Curl", targetMuscle: "Legs", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_calf_raise", name: "Calf Raise", targetMuscle: "Legs", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_walking_lunges", name: "Walking Lunges", targetMuscle: "Legs", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_hip_thrust", name: "Barbell Hip Thrust", targetMuscle: "Legs", equipment: "Barbell", isCustom: false, isArchived: false },

  // ARMS
  { id: "ex_barbell_curl", name: "Barbell Bicep Curl", targetMuscle: "Arms", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_db_bicep_curl", name: "Dumbbell Bicep Curl", targetMuscle: "Arms", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_hammer_curl", name: "Hammer Curl", targetMuscle: "Arms", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_preacher_curl", name: "Preacher Curl", targetMuscle: "Arms", equipment: "Machine", isCustom: false, isArchived: false },
  { id: "ex_tricep_pushdown", name: "Tricep Rope Pushdown", targetMuscle: "Arms", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_skull_crushers", name: "Skull Crushers", targetMuscle: "Arms", equipment: "Barbell", isCustom: false, isArchived: false },
  { id: "ex_overhead_tricep_ext", name: "Overhead Tricep Extension", targetMuscle: "Arms", equipment: "Dumbbell", isCustom: false, isArchived: false },
  { id: "ex_tricep_dips", name: "Tricep Dips (Bench / Parallel)", targetMuscle: "Arms", equipment: "Bodyweight", isCustom: false, isArchived: false },

  // CORE
  { id: "ex_hanging_leg_raise", name: "Hanging Leg Raise", targetMuscle: "Core", equipment: "Bodyweight", isCustom: false, isArchived: false },
  { id: "ex_cable_woodchopper", name: "Cable Woodchopper", targetMuscle: "Core", equipment: "Cable", isCustom: false, isArchived: false },
  { id: "ex_ab_wheel", name: "Ab Wheel Rollout", targetMuscle: "Core", equipment: "Other", isCustom: false, isArchived: false },
  { id: "ex_plank", name: "Plank", targetMuscle: "Core", equipment: "Bodyweight", isCustom: false, isArchived: false },
  { id: "ex_crunches", name: "Cable / Machine Crunch", targetMuscle: "Core", equipment: "Machine", isCustom: false, isArchived: false },
];
