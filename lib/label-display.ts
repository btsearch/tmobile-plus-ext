import type { BandDetails } from "./airfiber.ts";
import type { BTSearchStatus, LabelDisplayOptions, LabelsUpdatePayload, StationLabel, ThemeMode } from "./messages.ts";
import { isRecord } from "./utils.ts";

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

export function createLabelsSignature({ labels, options }: LabelsUpdatePayload): string {
  return JSON.stringify({ labels, options });
}

export function isLabelsUpdatePayload(value: unknown): value is LabelsUpdatePayload {
  if (!isRecord(value)) return false;

  return Array.isArray(value.labels) && value.labels.every(isStationLabel) && isLabelDisplayOptions(value.options) && isThemeMode(value.theme);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function isLabelDisplayOptions(value: unknown): value is LabelDisplayOptions {
  if (!isRecord(value)) return false;

  return (
    (value.azimuthMode === "per-band" || value.azimuthMode === "overall") &&
    typeof value.showCoordinates === "boolean" &&
    typeof value.showDSS === "boolean" &&
    typeof value.showBTSearchStatus === "boolean"
  );
}

function isStationLabel(value: unknown): value is StationLabel {
  if (!isRecord(value)) return false;

  return (
    typeof value.key === "string" &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    (typeof value.stationId === "string" || value.stationId === null) &&
    Array.isArray(value.lteBands) &&
    value.lteBands.every(isBandDetails) &&
    Array.isArray(value.nrBands) &&
    value.nrBands.every(isBandDetails) &&
    typeof value.isDSSEnabled === "boolean" &&
    typeof value.sectorCount === "number" &&
    Number.isFinite(value.sectorCount) &&
    Array.isArray(value.azimuths) &&
    value.azimuths.every((azimuth) => typeof azimuth === "number" && Number.isFinite(azimuth)) &&
    isBTSearchStatus(value.btSearchStatus)
  );
}

function isBandDetails(value: unknown): value is BandDetails {
  if (!isRecord(value)) return false;

  return (
    typeof value.band === "string" &&
    Array.isArray(value.azimuths) &&
    value.azimuths.every((azimuth) => typeof azimuth === "number" && Number.isFinite(azimuth))
  );
}

function isBTSearchStatus(value: unknown): value is BTSearchStatus | "unchecked" {
  return value === "unchecked" || value === "found" || value === "missing" || value === "error" || value === "unconfigured";
}
