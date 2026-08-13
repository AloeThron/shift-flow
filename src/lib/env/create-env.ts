import type { z } from "zod";

type CreateEnvOptions<T extends z.ZodRawShape> = {
  schema: z.ZodObject<T>;
  runtimeEnv: Record<keyof T & string, string | undefined>;
};

/** อ่านและ validate env แบบ fail-fast */
export function createEnv<T extends z.ZodRawShape>(
  options: CreateEnvOptions<T>,
): z.infer<z.ZodObject<T>> {
  const parsed = options.schema.safeParse(options.runtimeEnv);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  return parsed.data;
}
