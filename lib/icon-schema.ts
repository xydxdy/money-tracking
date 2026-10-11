import { z } from 'zod';
import { ICON_NAMES } from '@/lib/icons';

/** An icon from the registry (lib/icons.ts); an empty value means "no icon". */
export const iconName = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.enum(ICON_NAMES as [string, ...string[]]).optional(),
);
