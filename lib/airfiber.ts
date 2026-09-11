import { isRecord } from "./utils.ts";

export interface BandDetails {
  band: string;
  azimuths: number[];
}

export interface StationSnapshot {
  key: string;
  latitude: number;
  longitude: number;
  stationId: string | null;
  lteBands: BandDetails[];
  nrBands: BandDetails[];
  isDSSEnabled: boolean;
  sectorCount: number;
  azimuths: number[];
}

interface Coordinate {
  key: string;
  latitude: number;
  longitude: number;
}

interface MutableStation {
  key: string;
  latitude: number;
  longitude: number;
  stationId: string | null;
  lteBands: Map<string, Set<number>>;
  nrBands: Map<string, Set<number>>;
  isDSSEnabled: boolean;
  azimuths: Set<number>;
}

export function parseAirfiberStations(payload: unknown): StationSnapshot[] {
  const stations = new Map<string, MutableStation>();

  for (const record of readCellRecords(payload)) {
    const coordinate = readCoordinate(record);
    if (coordinate === null) continue;

    const station = stations.get(coordinate.key) ?? createStation(coordinate);
    const characteristics = readCharacteristics(record);
    const azimuth = readAzimuth(characteristics);

    station.stationId ??= readStationId(record);
    if (azimuth !== null) station.azimuths.add(azimuth);
    addBands(characteristics, "availableLteBands", station.lteBands, azimuth);
    addBands(characteristics, "available5gBands", station.nrBands, azimuth);
    station.isDSSEnabled ||= hasDSSEnabled(characteristics);
    stations.set(coordinate.key, station);
  }

  return [...stations.values()].map((station) => ({
    key: station.key,
    latitude: station.latitude,
    longitude: station.longitude,
    stationId: station.stationId,
    lteBands: serializeBands(station.lteBands),
    nrBands: serializeBands(station.nrBands),
    isDSSEnabled: station.isDSSEnabled,
    sectorCount: station.azimuths.size,
    azimuths: [...station.azimuths].sort((left, right) => left - right),
  }));
}

function readCellRecords(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((batchItem) => {
    if (!isRecord(batchItem)) return [];

    const { result } = batchItem;
    if (!isRecord(result)) return [];

    const { data } = result;
    if (!isRecord(data) || !Array.isArray(data.json)) return [];

    return data.json.filter(isRecord);
  });
}

function readCoordinate(record: Record<string, unknown>): Coordinate | null {
  const { geographicLocation } = record;
  if (!isRecord(geographicLocation) || !Array.isArray(geographicLocation.geometry)) return null;

  const geometry = geographicLocation.geometry[0];
  if (!isRecord(geometry) || typeof geometry.x !== "string" || typeof geometry.y !== "string") return null;

  const rawLongitude = geometry.x;
  const rawLatitude = geometry.y;
  const longitude = Number(rawLongitude);
  const latitude = Number(rawLatitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  return {
    key: `${rawLongitude},${rawLatitude}`,
    latitude,
    longitude,
  };
}

function readCharacteristics(record: Record<string, unknown>): Record<string, unknown>[] {
  if (!Array.isArray(record.characteristics)) return [];

  return record.characteristics.filter(isRecord);
}

function readStationId(record: Record<string, unknown>): string | null {
  for (const field of ["id", "name", "description"]) {
    const value = record[field];
    if (typeof value !== "string") continue;

    const stationId = /^ANT(\d+)/.exec(value)?.[1];
    if (stationId !== undefined) return stationId;
  }

  return null;
}

function addBands(
  characteristics: Record<string, unknown>[],
  characteristicName: "availableLteBands" | "available5gBands",
  bands: Map<string, Set<number>>,
  azimuth: number | null,
): void {
  for (const characteristic of characteristics) {
    if (characteristic.name !== characteristicName || !Array.isArray(characteristic.arrayValue)) continue;

    for (const value of characteristic.arrayValue) {
      if (typeof value !== "string" || value.length === 0) continue;

      const bandAzimuths = bands.get(value) ?? new Set<number>();
      if (azimuth !== null) bandAzimuths.add(azimuth);
      bands.set(value, bandAzimuths);
    }
  }
}

function readAzimuth(characteristics: Record<string, unknown>[]): number | null {
  for (const characteristic of characteristics) {
    if (characteristic.name !== "azimuth" || typeof characteristic.value !== "string") continue;

    const azimuth = Number(characteristic.value);
    if (Number.isFinite(azimuth)) return azimuth;
  }

  return null;
}

function hasDSSEnabled(characteristics: Record<string, unknown>[]): boolean {
  return characteristics.some((characteristic) => characteristic.name === "isDSSEnabled" && characteristic.value === "true");
}

function createStation(coordinate: Coordinate): MutableStation {
  return {
    key: coordinate.key,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    stationId: null,
    lteBands: new Map<string, Set<number>>(),
    nrBands: new Map<string, Set<number>>(),
    isDSSEnabled: false,
    azimuths: new Set<number>(),
  };
}

function serializeBands(bands: Map<string, Set<number>>): BandDetails[] {
  return [...bands.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([band, azimuths]) => ({
      band,
      azimuths: [...azimuths].sort((left, right) => left - right),
    }));
}
