import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines conditional class names with Tailwind CSS resolution.
 * Merges Tailwind classes without style conflicts.
 *
 * @param inputs - Array of class values or conditional class mappings
 * @returns Resolved CSS class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
