/** ชนิด metric ที่เก็บใน memory store */
export type MetricKind = "counter" | "gauge";

export type MetricSnapshot = {
  name: string;
  kind: MetricKind;
  value: number;
  labels: Record<string, string>;
};

type MetricKey = string;

/** สร้าง key จาก metric name + labels */
function metricKey(name: string, labels: Record<string, string>): MetricKey {
  const labelPart = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
  return labelPart.length > 0 ? `${name}{${labelPart}}` : name;
}

/** in-memory metrics collector — พร้อม export เป็น snapshot */
export class MetricsCollector {
  private readonly counters = new Map<MetricKey, number>();
  private readonly gauges = new Map<MetricKey, number>();
  private readonly labelMap = new Map<MetricKey, Record<string, string>>();
  private readonly nameMap = new Map<MetricKey, string>();

  /** เพิ่ม counter */
  increment(name: string, labels: Record<string, string> = {}, delta = 1): void {
    const key = metricKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + delta);
    this.labelMap.set(key, labels);
    this.nameMap.set(key, name);
  }

  /** ตั้งค่า gauge */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = metricKey(name, labels);
    this.gauges.set(key, value);
    this.labelMap.set(key, labels);
    this.nameMap.set(key, name);
  }

  /** อ่าน snapshot ทั้งหมด */
  snapshot(): readonly MetricSnapshot[] {
    const items: MetricSnapshot[] = [];

    for (const [key, value] of this.counters.entries()) {
      items.push({
        name: this.nameMap.get(key) ?? key,
        kind: "counter",
        value,
        labels: this.labelMap.get(key) ?? {},
      });
    }

    for (const [key, value] of this.gauges.entries()) {
      items.push({
        name: this.nameMap.get(key) ?? key,
        kind: "gauge",
        value,
        labels: this.labelMap.get(key) ?? {},
      });
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** รีเซ็ต metrics ทั้งหมด */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.labelMap.clear();
    this.nameMap.clear();
  }
}

/** metrics singleton สำหรับ runtime */
export const metrics = new MetricsCollector();
