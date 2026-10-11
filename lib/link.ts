import { z } from 'zod';

/**
 * A user-supplied link (e.g. to a receipt). Only absolute http(s) URLs are accepted: the link is
 * rendered as a clickable <a href>, so allowing other schemes (javascript:, data:, …) would let a
 * saved value run script when clicked.
 */
export const httpUrl = z.string().trim().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, { message: 'Enter a full link starting with http:// or https://' });

/** Rendering guard: returns the URL only if it is still a safe http(s) link. */
export function safeHref(value: string | null | undefined): string | undefined {
  return value && httpUrl.safeParse(value).success ? value : undefined;
}
