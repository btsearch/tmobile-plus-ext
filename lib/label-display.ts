import type { BandDetails } from "./airfiber.ts";
import type { BTSearchStatus, LabelDisplayOptions, LabelsUpdatePayload, StationLabel } from "./messages.ts";
import { asRecord } from "./utils.ts";

export function formatBandDetails(technology: string, { band, azimuths }: BandDetails, showAzimuths: boolean): string {
  if (!showAzimuths) return `${technology} ${band}`;

  const values = azimuths.length > 0 ? azimuths.map((azimuth) => `${azimuth}°`).join("/") : "-";
  return `${technology} ${band}: ${values}`;
}

export function formatOverallAzimuths(azimuths: number[]): string {
  if (azimuths.length === 0) return "";

  return `AZ ${azimuths.map((azimuth) => `${azimuth}°`).join(" · ")}`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)} · ${longitude.toFixed(6)}`;
}

export function formatSectorCount(count: number): string {
  if (count === 1) return "1 sektor";

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const usesFewForm = lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14);
  return `${count} ${usesFewForm ? "sektory" : "sektorów"}`;
}

export function isPicocell(azimuths: number[]): boolean {
  return azimuths.length === 1 && (azimuths[0] === 0 || azimuths[0] === 360);
}

export function createLabelsSignature(payload: LabelsUpdatePayload): string {
  return JSON.stringify(payload);
}

export function isLabelsUpdatePayload(value: unknown): value is LabelsUpdatePayload {
  const item = asRecord(value);
  if (item === null) return false;

  return Array.isArray(item.labels) && item.labels.every(isStationLabel) && isLabelDisplayOptions(item.options);
}

function isLabelDisplayOptions(value: unknown): value is LabelDisplayOptions {
  const item = asRecord(value);
  if (item === null) return false;

  return (
    (item.azimuthMode === "per-band" || item.azimuthMode === "overall") &&
    typeof item.showCoordinates === "boolean" &&
    typeof item.showDSS === "boolean" &&
    typeof item.showBTSearchStatus === "boolean"
  );
}

function isStationLabel(value: unknown): value is StationLabel {
  const item = asRecord(value);
  if (item === null) return false;

  return (
    typeof item.key === "string" &&
    typeof item.latitude === "number" &&
    Number.isFinite(item.latitude) &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.longitude) &&
    (typeof item.stationId === "string" || item.stationId === null) &&
    Array.isArray(item.lteBands) &&
    item.lteBands.every(isBandDetails) &&
    Array.isArray(item.nrBands) &&
    item.nrBands.every(isBandDetails) &&
    typeof item.isDSSEnabled === "boolean" &&
    typeof item.sectorCount === "number" &&
    Number.isFinite(item.sectorCount) &&
    Array.isArray(item.azimuths) &&
    item.azimuths.every((azimuth) => typeof azimuth === "number" && Number.isFinite(azimuth)) &&
    isBTSearchStatus(item.btSearchStatus)
  );
}

function isBandDetails(value: unknown): value is BandDetails {
  const item = asRecord(value);
  if (item === null) return false;

  return (
    typeof item.band === "string" &&
    Array.isArray(item.azimuths) &&
    item.azimuths.every((azimuth) => typeof azimuth === "number" && Number.isFinite(azimuth))
  );
}

function isBTSearchStatus(value: unknown): value is BTSearchStatus | "unchecked" {
  return value === "unchecked" || value === "found" || value === "missing" || value === "error" || value === "unconfigured";
}
