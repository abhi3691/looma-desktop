import { settingsSchema } from "./shared";
// Zod defaults may appear even inside optional fields. Only explicit patch keys
// may replace stored preferences.
export function parseSettingsPatch(value: unknown) {
  const parsed = settingsSchema.partial().parse(value);
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).map(key => [key, parsed[key as keyof typeof parsed]]));
}
