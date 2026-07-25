import type { BandDetails } from "./airfiber.ts";
import { asRecord } from "./utils.ts";

export const CELL_RESPONSE_EVENT = "tmobile-bts-labels:cell-response";
export const LABELS_UPDATE_EVENT = "tmobile-bts-labels:labels-update";

export type BTSearchStatus = "found" | "missing" | "error" | "unconfigured";
export type AzimuthMode = "per-band" | "overall";

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
  const candidate = asRecord(value);
  if (candidate === null) return false;

  if (candidate.type === "btsearch:lookup") return typeof candidate.stationId === "string" && /^\d+$/.test(candidate.stationId);

  return (
    candidate.type === "btsearch:lookup-gps" &&
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude)
  );
}
