import { redactSensitive } from "./redact";

/** ระดับ log ที่รองรับ */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** อ่าน LOG_LEVEL จาก env โดยไม่ trigger full env validation */
function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

const ACTIVE_LOG_LEVEL = resolveLogLevel();

/** ฟิลด์มาตรฐานของ structured log */
export type LogFields = Record<string, unknown>;

/** สร้าง structured log entry */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  fields: LogFields = {},
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "shift-flow",
    ...redactSensitive(fields),
  };
}

/** ตรวจว่าระดับ log ควร emit หรือไม่ */
export function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[ACTIVE_LOG_LEVEL];
}

/** logger แบบ structured — ใช้ stdout สำหรับ aggregation */
export const logger = {
  debug(message: string, fields: LogFields = {}): void {
    if (!shouldLog("debug")) {
      return;
    }
    console.debug(JSON.stringify(formatLogEntry("debug", message, fields)));
  },

  info(message: string, fields: LogFields = {}): void {
    if (!shouldLog("info")) {
      return;
    }
    console.info(JSON.stringify(formatLogEntry("info", message, fields)));
  },

  warn(message: string, fields: LogFields = {}): void {
    if (!shouldLog("warn")) {
      return;
    }
    console.warn(JSON.stringify(formatLogEntry("warn", message, fields)));
  },

  error(message: string, fields: LogFields = {}): void {
    if (!shouldLog("error")) {
      return;
    }
    console.error(JSON.stringify(formatLogEntry("error", message, fields)));
  },
};
