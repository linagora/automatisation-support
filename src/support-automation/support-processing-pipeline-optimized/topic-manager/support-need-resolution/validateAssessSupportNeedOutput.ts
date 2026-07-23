import {formatCatalogSelection} from "./catalogSelection";

import type {SupportNeed, SupportNeedUnclearReason} from "../../../support-catalog-optimized/supportTopicBranch.catalog";

type SupportNeedAssessment = {
  supportNeed: SupportNeed;
  unclearReason: SupportNeedUnclearReason | null;
  reason: string;
};

function validateAssessSupportNeedOutput(parsedResponse: unknown): SupportNeedAssessment | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["supportNeedAssessment"])) return null;

  return validateSupportNeedAssessment(parsedResponse.supportNeedAssessment);
}

function validateSupportNeedAssessment(value: unknown): SupportNeedAssessment | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["supportNeed", "unclearReason", "reason"])) return null;

  const supportNeed = validateEnumValue(
    value.supportNeed,
    formatCatalogSelection.supportNeeds as readonly SupportNeed[]
  );
  const reason = validateNonEmptyString(value.reason);

  if (!supportNeed || !reason) return null;

  if (supportNeed === "unclear") {
    const unclearReason = validateEnumValue(
      value.unclearReason,
      formatCatalogSelection.supportNeedUnclearReasons as readonly SupportNeedUnclearReason[]
    );

    return unclearReason
      ? {
          supportNeed,
          unclearReason,
          reason
        }
      : null;
  }

  return value.unclearReason === null
    ? {
        supportNeed,
        unclearReason: null,
        reason
      }
    : null;
}

function validateEnumValue<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[]
): TValue | null {
  return typeof value === "string" && allowedValues.includes(value as TValue)
    ? value as TValue
    : null;
}

function validateNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateAssessSupportNeedOutput};

export type {
  SupportNeed,
  SupportNeedAssessment,
  SupportNeedUnclearReason
};
