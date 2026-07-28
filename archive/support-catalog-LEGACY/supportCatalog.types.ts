import {
  CASE_DETAIL_FIELD_DEFINITIONS,
  SUPPORT_METADATA_FIELD_DEFINITIONS
} from "./supportFields.catalog";
import {
  BROAD_CATEGORY_HINTS,
  BROAD_INTENT_MODES,
  MESSAGE_KIND_VALUES
} from "./supportTaxonomy.catalog";

type StrictSupportCaseDetailFieldName = keyof typeof CASE_DETAIL_FIELD_DEFINITIONS;
type StrictSupportMetadataFieldName = keyof typeof SUPPORT_METADATA_FIELD_DEFINITIONS;
type StrictBroadCategoryHint = typeof BROAD_CATEGORY_HINTS[number];
type StrictBroadIntentMode = typeof BROAD_INTENT_MODES[number];
type StrictMessageKindValue = typeof MESSAGE_KIND_VALUES[number];

type SupportCaseDetailFieldName =
  | StrictSupportCaseDetailFieldName
  | (string & {});
type SupportMetadataFieldName =
  | StrictSupportMetadataFieldName
  | (string & {});
type BroadCategoryHint =
  | StrictBroadCategoryHint
  | (string & {});
type BroadIntentMode =
  | StrictBroadIntentMode
  | (string & {});
type MessageKindValue =
  | StrictMessageKindValue
  | (string & {});

export type {
  BroadCategoryHint,
  BroadIntentMode,
  MessageKindValue,
  StrictBroadCategoryHint,
  StrictBroadIntentMode,
  StrictMessageKindValue,
  StrictSupportCaseDetailFieldName,
  StrictSupportMetadataFieldName,
  SupportCaseDetailFieldName,
  SupportMetadataFieldName
};
