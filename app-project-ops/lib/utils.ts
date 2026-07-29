import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names, resolving conflicting utility classes
 * (e.g. "p-2" vs "p-4") in favor of the last one supplied.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getFullname = (user?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) =>
  [user?.firstName, user?.lastName].join(" ")?.trim() ||
  user?.email?.split("@")[0] ||
  undefined;
