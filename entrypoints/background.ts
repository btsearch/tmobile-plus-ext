import { type BTSearchLookupMessage, type BTSearchLookupResponse, isBTSearchLookupMessage } from "@/lib/messages.ts";
import { btSearchApiKey } from "@/lib/settings.ts";
import { isRecord } from "@/lib/utils.ts";

const btSearchEndpoint = "https://btsearch.pl/api/v1/search?limit=100&sortBy=relevance";
const tmobileMnc = 26002;

export default defineBackground(() => {
  const lookupCache = new Map<string, Promise<BTSearchLookupResponse>>();
  let cachedApiKey: string | undefined;
  let cacheGeneration = 0;

  browser.runtime.onMessage.addListener(async (message: unknown) => {
    if (!isBTSearchLookupMessage(message)) return undefined;

    const apiKey = (await btSearchApiKey.getValue()).trim();
    if (apiKey !== cachedApiKey) {
      lookupCache.clear();
      cachedApiKey = apiKey;
      cacheGeneration += 1;
    }

    const lookupKey = message.type === "btsearch:lookup" ? `id:${message.stationId}` : `gps:${message.latitude},${message.longitude}`;
    const cacheKey = `${cacheGeneration}:${lookupKey}`;
    const existing = lookupCache.get(cacheKey);
    if (existing !== undefined) return existing;

    const lookup = lookupStation(message, apiKey)
      .then((result) => {
        if (result.status === "error") lookupCache.delete(cacheKey);
        return result;
      })
      .catch(() => {
        lookupCache.delete(cacheKey);
        return { status: "error" as const, stationId: null };
      });
    lookupCache.set(cacheKey, lookup);
    return lookup;
  });
});

async function lookupStation(message: BTSearchLookupMessage, apiKey: string): Promise<BTSearchLookupResponse> {
  if (apiKey.length === 0) return { status: "unconfigured", stationId: null };

  const query =
    message.type === "btsearch:lookup"
      ? `bts_id: '${message.stationId}' mnc: ${tmobileMnc}`
      : `gps:${message.latitude},${message.longitude} mnc: ${tmobileMnc}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(btSearchEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch {
    return { status: "error", stationId: null };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) return { status: "error", stationId: null };

  const payload: unknown = await response.json();
  const stationId = findMatchingStationId(payload, message);
  return {
    status: stationId === null ? "missing" : "found",
    stationId,
  };
}

function findMatchingStationId(payload: unknown, message: BTSearchLookupMessage): string | null {
  const pending: unknown[] = [payload];

  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }

    if (!isRecord(current)) continue;

    const operator = isRecord(current.operator) ? current.operator : null;
    const location = isRecord(current.location) ? current.location : null;
    const stationId = current.station_id;

    if (typeof stationId === "string" && operator?.mnc === tmobileMnc && matchesLookup(message, stationId, location)) return stationId;

    pending.push(...Object.values(current));
  }

  return null;
}

function matchesLookup(message: BTSearchLookupMessage, stationId: string, location: Record<string, unknown> | null): boolean {
  if (message.type === "btsearch:lookup") return stationId === message.stationId;

  return location?.latitude === message.latitude && location.longitude === message.longitude;
}
