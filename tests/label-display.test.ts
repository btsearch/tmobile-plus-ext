import assert from "node:assert/strict";
import test from "node:test";

import {
  createLabelsSignature,
  formatBandDetails,
  formatOverallAzimuths,
  formatSectorCount,
  isLabelsUpdatePayload,
  isPicocell,
} from "../lib/label-display.ts";
import { DEFAULT_LABEL_DISPLAY_OPTIONS, type LabelsUpdatePayload } from "../lib/messages.ts";

void test("formats per-band and overall azimuth modes", () => {
  const band = { band: "800", azimuths: [20, 130] };

  assert.equal(formatBandDetails("LTE", band, true), "LTE 800: 20°/130°");
  assert.equal(formatBandDetails("LTE", band, false), "LTE 800");
  assert.equal(formatOverallAzimuths([20, 130, 250]), "AZ 20° · 130° · 250°");
  assert.equal(formatOverallAzimuths([]), "");
});

void test("uses the correct Polish sector inflection", () => {
  assert.equal(formatSectorCount(1), "1 sektor");
  assert.equal(formatSectorCount(3), "3 sektory");
  assert.equal(formatSectorCount(5), "5 sektorów");
  assert.equal(formatSectorCount(12), "12 sektorów");
  assert.equal(formatSectorCount(22), "22 sektory");
});

void test("identifies picocells from their complete azimuth set", () => {
  assert.equal(isPicocell([0]), true);
  assert.equal(isPicocell([360]), true);
  assert.equal(isPicocell([0, 360]), false);
  assert.equal(isPicocell([]), false);
  assert.equal(isPicocell([0, 120]), false);
});

void test("changes the render signature when only display options change", () => {
  const payload = createPayload();
  const withoutCoordinates: LabelsUpdatePayload = {
    ...payload,
    options: { ...payload.options, showCoordinates: false },
  };

  assert.notEqual(createLabelsSignature(payload), createLabelsSignature(withoutCoordinates));
});

void test("validates the complete labels update payload and status union", () => {
  const payload = createPayload();
  const invalidPayload = {
    ...payload,
    labels: [{ ...payload.labels[0], btSearchStatus: "unexpected" }],
  };

  assert.equal(isLabelsUpdatePayload(payload), true);
  assert.equal(isLabelsUpdatePayload(invalidPayload), false);
});

function createPayload(): LabelsUpdatePayload {
  return {
    labels: [
      {
        key: "18.170633,53.990665",
        latitude: 53.990665,
        longitude: 18.170633,
        stationId: "33266",
        lteBands: [{ band: "800", azimuths: [20, 130] }],
        nrBands: [{ band: "3600", azimuths: [250] }],
        isDSSEnabled: true,
        sectorCount: 3,
        azimuths: [20, 130, 250],
        btSearchStatus: "found",
      },
    ],
    options: { ...DEFAULT_LABEL_DISPLAY_OPTIONS },
  };
}
