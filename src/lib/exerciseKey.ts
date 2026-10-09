// src/lib/exerciseKey.ts
import { EquipmentType, MuscleGroup } from "@/types";

/**
 * Generates a deterministic key for an exercise based on equipment, target muscle,
 * and core movement keywords. Strips noise words and sorts tokens alphabetically.
 *
 * Examples:
 * "Incline Dumbbell Press" + "Dumbbell" + "Chest" -> "dumbbell_chest_incline_press"
 * "Incline Press"          + "Dumbbell" + "Chest" -> "dumbbell_chest_incline_press"
 * "Hammer Curls"           + "Dumbbell" + "Arms"  -> "dumbbell_arms_curl_hammer"
 */
export function generateCanonicalKey(
  name: string,
  targetMuscle: MuscleGroup,
  equipment: EquipmentType
): string {
  let movement = (name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");

  const stopWords = new Set([
    equipment.toLowerCase(),
    targetMuscle.toLowerCase(),
    "barbell",
    "dumbbell",
    "cable",
    "machine",
    "bodyweight",
    "smith",
    "kettlebell",
    "chest",
    "back",
    "leg",
    "legs",
    "shoulder",
    "shoulders",
    "arm",
    "arms",
    "core",
    "exercise",
    "workout",
  ]);

  // Stem common plural/verb suffixes
  movement = movement
    .replace(/\bcurls\b/g, "curl")
    .replace(/\bpresses\b/g, "press")
    .replace(/\braises\b/g, "raise")
    .replace(/\bpulls\b/g, "pull")
    .replace(/\bextensions\b/g, "extension")
    .replace(/\bcrushers\b/g, "crusher")
    .replace(/\bdeadlifts\b/g, "deadlift")
    .replace(/\bsquats\b/g, "squat");

  const tokens = movement
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stopWords.has(word));

  const sortedTokens = tokens.sort().join("_");
  return `${equipment}_${targetMuscle}_${sortedTokens}`.toLowerCase();
}