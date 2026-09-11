import assert from "node:assert/strict";
import test from "node:test";

import { parseAirfiberStations } from "../lib/airfiber.ts";

void test("groups the exact airfiber cell shape by raw coordinates", () => {
  const payload = [
    {
      result: {
        data: {
          json: [
            createCell(
              "ANT33266A",
              "18.170633",
              "53.990665",
              "20",
              {
                lte: ["800", "800", "1800"],
                nr: [],
              },
              true,
            ),
            createCell("ANT33266B", "18.170633", "53.990665", "130", {
              lte: ["800", "2100"],
              nr: [],
            }),
            createCell("ANT33266C", "18.170633", "53.990665", "250", {
              lte: ["2600"],
              nr: [],
            }),
            createCell("ANT33266G", "18.170633", "53.990665", "130", {
              lte: [],
              nr: ["2100"],
            }),
            createCell("ANT33266H", "18.170633", "53.990665", "20", {
              lte: [],
              nr: ["3600"],
            }),
            createCell("ANT33266I", "18.170633", "53.990665", "250", {
              lte: [],
              nr: ["3600"],
            }),
          ],
        },
      },
    },
  ];

  assert.deepEqual(parseAirfiberStations(payload), [
    {
      key: "18.170633,53.990665",
      latitude: 53.990665,
      longitude: 18.170633,
      stationId: "33266",
      lteBands: [
        { band: "800", azimuths: [20, 130] },
        { band: "1800", azimuths: [20] },
        { band: "2100", azimuths: [130] },
        { band: "2600", azimuths: [250] },
      ],
      nrBands: [
        { band: "2100", azimuths: [130] },
        { band: "3600", azimuths: [20, 250] },
      ],
      isDSSEnabled: true,
      sectorCount: 3,
      azimuths: [20, 130, 250],
    },
  ]);
});

void test("keeps a coordinate group when station identity fields are empty", () => {
  const cell = createCell("", "19.100000", "50.200000", "0", {
    lte: ["900"],
    nr: [],
  });
  cell.name = "";
  cell.description = "";

  const payload = [{ result: { data: { json: [cell] } } }];

  assert.deepEqual(parseAirfiberStations(payload), [
    {
      key: "19.100000,50.200000",
      latitude: 50.2,
      longitude: 19.1,
      stationId: null,
      lteBands: [{ band: "900", azimuths: [0] }],
      nrBands: [],
      isDSSEnabled: false,
      sectorCount: 1,
      azimuths: [0],
    },
  ]);
});

void test("extracts a station id before a multi-letter antenna suffix", () => {
  const cell = createCell("ANT50210AB", "19.100000", "50.200000", "0", {
    lte: ["900"],
    nr: [],
  });
  const payload = [{ result: { data: { json: [cell] } } }];

  assert.equal(parseAirfiberStations(payload)[0]?.stationId, "50210");
});

void test("ignores malformed AirFiber records", () => {
  const payload = [null, "invalid", { result: null }, { result: { data: { json: [null, "invalid", []] } } }];

  assert.deepEqual(parseAirfiberStations(payload), []);
});

function createCell(id: string, x: string, y: string, azimuth: string, bands: { lte: string[]; nr: string[] }, isDSSEnabled = false) {
  return {
    id,
    name: id,
    description: "",
    geographicLocation: {
      geometryType: "point",
      geometry: [{ x, y }],
    },
    characteristics: [
      { name: "azimuth", value: azimuth },
      { name: "availableLteBands", valueType: "array", arrayValue: bands.lte },
      { name: "available5gBands", valueType: "array", arrayValue: bands.nr },
      { name: "isDSSEnabled", value: String(isDSSEnabled) },
    ],
    categories: [{ id: "HomeZoneAntenna" }],
  };
}
