import type { BandDetails } from "./airfiber.ts";
import { isRecord } from "./utils.ts";

export const CELL_RESPONSE_EVENT = "tmobile-bts-labels:cell-response";
export const LABELS_UPDATE_EVENT = "tmobile-bts-labels:labels-update";

export type BTSearchStatus = "found" | "missing" | "error" | "unconfigured";
export type AzimuthMode = "per-band" | "overall";
export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "light";

export interface LabelDisplayOptions {
  azimuthMode: AzimuthMode;
  showCoordinates: boolean;
  showDSS: boolean;
  showBTSearchStatus: boolean;
}

export const DEFAULT_LABEL_DISPLAY_OPTIONS: LabelDisplayOptions = {
  azimuthMode: "per-band",
  showCoordinates: true,
  showDSS: true,
  showBTSearchStatus: true,
};

export interface StationLabel {
  key: string;
  latitude: number;
  longitude: number;
  stationId: string | null;
  lteBands: BandDetails[];
  nrBands: BandDetails[];
  isDSSEnabled: boolean;
  sectorCount: number;
  azimuths: number[];
  btSearchStatus: BTSearchStatus | "unchecked";
}

export interface LabelsUpdatePayload {
  labels: StationLabel[];
  options: LabelDisplayOptions;
  theme: ThemeMode;
}

export interface BTSearchStationIdLookupMessage {
  type: "btsearch:lookup";
  stationId: string;
}

export interface BTSearchGPSLookupMessage {
  type: "btsearch:lookup-gps";
  latitude: number;
  longitude: number;
}

export type BTSearchLookupMessage = BTSearchStationIdLookupMessage | BTSearchGPSLookupMessage;

export interface BTSearchLookupResponse {
  status: BTSearchStatus;
  stationId: string | null;
}

export function isBTSearchLookupMessage(value: unknown): value is BTSearchLookupMessage {
  if (!isRecord(value)) return false;

  if (value.type === "btsearch:lookup") return typeof value.stationId === "string" && /^\d+$/.test(value.stationId);

  return (
    value.type === "btsearch:lookup-gps" &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude)
  );
}
