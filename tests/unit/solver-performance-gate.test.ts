import { spawn } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** รัน subprocess แล้วคืน exit code */
function runPerformanceGateSubprocess(): Promise<void> {
  const scriptPath = join(process.cwd(), "tests/helpers/run-solver-performance-gate.ts");

  return new Promise((resolve, reject) => {
    const child = spawn("pnpm exec tsx", [`"${scriptPath}"`], {
      shell: true,
      stdio: "pipe",
      env: process.env,
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `performance gate subprocess exit ${code ?? "unknown"}`));
    });
  });
}

/** รัน performance gate ใน subprocess — หลีกเลี่ยง vitest worker block จาก CPU-bound solver */
describe("solver performance gate", () => {
  it("p95 draft pipeline ≤ 120s บนข้อมูล validation +25%", async () => {
    await expect(runPerformanceGateSubprocess()).resolves.toBeUndefined();
  }, 620_000);
});
