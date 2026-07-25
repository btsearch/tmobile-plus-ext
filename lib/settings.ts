import { storage } from "#imports";

import { DEFAULT_LABEL_DISPLAY_OPTIONS, type LabelDisplayOptions } from "./messages";

export const extensionEnabled = storage.defineItem<boolean>("local:extension-enabled", {
  fallback: true,
});

export const btSearchApiKey = storage.defineItem<string>("local:btsearch-api-key", {
  fallback: "",
});

export const labelDisplayOptions = storage.defineItem<LabelDisplayOptions>("local:label-display-options-v2", {
  fallback: DEFAULT_LABEL_DISPLAY_OPTIONS,
});
