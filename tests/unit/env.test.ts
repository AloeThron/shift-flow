import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEnv } from "@/lib/env/create-env";

/** ทดสอบ validation ของ environment helper */
describe("createEnv", () => {
  it("คืนค่า env ที่ validate แล้ว", () => {
    const schema = z.object({
      FOO: z.string(),
    });

    const result = createEnv({
      schema,
      runtimeEnv: { FOO: "bar" },
    });

    expect(result.FOO).toBe("bar");
  });

  it("throw เมื่อ env ไม่ครบ", () => {
    const schema = z.object({
      REQUIRED: z.string(),
    });

    expect(() =>
      createEnv({
        schema,
        runtimeEnv: { REQUIRED: undefined },
      }),
    ).toThrow(/Invalid environment variables/);
  });
});
