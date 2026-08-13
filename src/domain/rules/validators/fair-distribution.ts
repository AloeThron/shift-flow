import {
  type FairnessDimension,
  type FairnessScope,
  groupStaffIdsByScope,
  staffFairnessMetric,
} from "@/domain/rules/helpers/schedule-metrics";
import type { RuleValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** SC-001/002/007 — กระจายภาระอย่างเป็นธรรม (soft) */
export const validateFairDistribution: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    dimension?: FairnessDimension;
    scope?: FairnessScope;
    toleranceHours?: number;
    normalizeByFte?: boolean;
    lookbackMonths?: number;
  };

  const dimension = params.dimension ?? "TOTAL_HOURS";
  const scope = params.scope ?? "GROUP";
  const toleranceHours = params.toleranceHours ?? 4;
  const normalizeByFte = params.normalizeByFte ?? true;
  const lookbackMonths = params.lookbackMonths ?? 6;
  const violations: ConstraintViolation[] = [];

  for (const [groupKey, staffIds] of groupStaffIdsByScope(context, scope)) {
    if (staffIds.length < 2) {
      continue;
    }

    const metrics = staffIds.map((staffId) => ({
      staffId,
      value: staffFairnessMetric(context, staffId, dimension, lookbackMonths, normalizeByFte),
    }));

    const values = metrics.map((entry) => entry.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue;

    if (spread <= toleranceHours) {
      continue;
    }

    for (const entry of metrics) {
      const distanceFromMin = entry.value - minValue;
      const distanceFromMax = maxValue - entry.value;
      const isOutlier =
        distanceFromMin > toleranceHours / 2 || distanceFromMax > toleranceHours / 2;

      if (!isOutlier) {
        continue;
      }

      violations.push({
        code: "FAIR_DISTRIBUTION",
        source: "RULE",
        ruleTemplateId: ruleInstance.ruleTemplateId,
        ruleInstanceId: ruleInstance.id,
        severity: ruleInstance.severity,
        weight: ruleInstance.weight ?? undefined,
        messageTh: `ค่า ${dimension} ${entry.value.toFixed(1)} ต่างจากช่วงกลุ่ม (${minValue.toFixed(1)}–${maxValue.toFixed(1)}) เกิน tolerance ${toleranceHours}`,
        staffId: entry.staffId,
        details: {
          dimension,
          scope,
          groupKey,
          value: entry.value,
          minValue,
          maxValue,
          spread,
          toleranceHours,
          lookbackMonths,
          normalizeByFte,
        },
      });
    }
  }

  return violations;
};
