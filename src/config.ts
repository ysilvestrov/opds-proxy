import { z } from "zod";
const schema = z.object({
  PUBLIC_BASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    }),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  CACHE_PATH: z.string().min(1),
  OPDS_USERNAME: z
    .string()
    .min(1)
    .max(128)
    .refine((v) => !v.includes(":")),
  OPDS_PASSWORD: z.string().min(1).max(1024),
  RELEASE_SHA: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .default("0000000000000000000000000000000000000000"),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env: Record<string, unknown> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw Error(
      "Invalid configuration: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  return {
    ...parsed.data,
    PUBLIC_BASE_URL: parsed.data.PUBLIC_BASE_URL.replace(/\/+$/, ""),
  };
}
