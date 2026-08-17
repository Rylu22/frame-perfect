export type TierKey =
  | "easy"
  | "normal"
  | "hard"
  | "harder"
  | "insane"
  | "demon-easy"
  | "demon-medium"
  | "demon-hard"
  | "demon-insane"
  | "demon-extreme";

export const TIERS: { key: TierKey; label: string; color: string }[] = [
  { key: "easy", label: "Easy", color: "#3ddc84" },
  { key: "normal", label: "Normal", color: "#4f8fff" },
  { key: "hard", label: "Hard", color: "#ffb84f" },
  { key: "harder", label: "Harder", color: "#ff6b4f" },
  { key: "insane", label: "Insane", color: "#ff4fd8" },
  { key: "demon-easy", label: "Easy Demon", color: "#b56bff" },
  { key: "demon-medium", label: "Medium Demon", color: "#8a3ffc" },
  { key: "demon-hard", label: "Hard Demon", color: "#ff3b6e" },
  { key: "demon-insane", label: "Insane Demon", color: "#ff2d2d" },
  { key: "demon-extreme", label: "Extreme Demon", color: "#ff1a1a" },
];

export function tierByKey(key: string | null | undefined) {
  return TIERS.find((t) => t.key === key) ?? null;
}
