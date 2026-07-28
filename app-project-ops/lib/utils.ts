import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { UpdateMeDto } from "./api/types";

/**
 * Merges Tailwind class names, resolving conflicting utility classes
 * (e.g. "p-2" vs "p-4") in favor of the last one supplied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getFullname = (user: UpdateMeDto) =>
  [user?.firstName, user?.lastName].join(" ")?.trim() ||
  user?.email?.split("@")[0];
