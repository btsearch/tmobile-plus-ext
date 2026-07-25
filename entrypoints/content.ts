import { parseAirfiberStations } from "@/lib/airfiber.ts";
import {
  type BTSearchLookupMessage,
  type BTSearchLookupResponse,
  CELL_RESPONSE_EVENT,
  DEFAULT_LABEL_DISPLAY_OPTIONS,
  LABELS_UPDATE_EVENT,
  type LabelDisplayOptions,
  type LabelsUpdatePayload,
  type StationLabel,
} from "@/lib/messages.ts";
import { btSearchApiKey, extensionEnabled, labelDisplayOptions } from "@/lib/settings.ts";

export default defineContentScript({
  matches: ["https://www.t-mobile.pl/mapa-nadajnikow*"],
  runAt: "document_start",

  async main() {
    let bridgeElement: HTMLScriptElement | undefined;
    let latestLabels: StationLabel[] = [];
    let labelsEnabled = true;
    let displayOptions = DEFAULT_LABEL_DISPLAY_OPTIONS;
    let responseSequence = 0;

    const dispatchCurrentLabels = () => {
      dispatchLabels(bridgeElement, labelsEnabled ? latestLabels : [], displayOptions);
    };

    const publishLabels = (labels: StationLabel[]) => {
      latestLabels = labels;
      dispatchCurrentLabels();
    };

    const processPayload = async (payload: unknown) => {
      const sequence = ++responseSequence;
      const stations = parseAirfiberStations(payload);
      const initialLabels: StationLabel[] = stations.map((station) => ({
        ...station,
        btSearchStatus: "unchecked",
      }));

      publishLabels(initialLabels);

      const enrichedLabels = await Promise.all(initialLabels.map(enrichWithBTSearch));
      if (sequence !== responseSequence) return;

      publishLabels(enrichedLabels);
    };

    const settingsLoaded = Promise.all([extensionEnabled.getValue(), labelDisplayOptions.getValue()]).then(([enabled, options]) => {
      labelsEnabled = enabled;
      displayOptions = options;
    });

    await Promise.all([
      injectScript("/airfiber-watcher.js", {
        keepInDom: true,
        modifyScript(script) {
          bridgeElement = script;
          script.addEventListener(CELL_RESPONSE_EVENT, (event) => {
            if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;

            let payload: unknown;
            try {
              payload = JSON.parse(event.detail);
            } catch {
              publishLabels([]);
              return;
            }

            void settingsLoaded.then(() => processPayload(payload)).catch(() => publishLabels([]));
          });
        },
      }),
      settingsLoaded,
    ]);

    dispatchCurrentLabels();

    extensionEnabled.watch((enabled) => {
      labelsEnabled = enabled;
      dispatchCurrentLabels();
    });

    labelDisplayOptions.watch((options) => {
      displayOptions = options;
      dispatchCurrentLabels();
    });

    btSearchApiKey.watch(() => {
      const sequence = ++responseSequence;
      const uncheckedLabels = latestLabels.map((label) => ({
        ...label,
        btSearchStatus: "unchecked" as const,
      }));
      publishLabels(uncheckedLabels);

      void Promise.all(uncheckedLabels.map(enrichWithBTSearch)).then((enrichedLabels) => {
        if (sequence !== responseSequence) return;

        publishLabels(enrichedLabels);
      });
    });
  },
});

async function enrichWithBTSearch(label: StationLabel): Promise<StationLabel> {
  const message: BTSearchLookupMessage =
    label.stationId === null
      ? {
          type: "btsearch:lookup-gps",
          latitude: label.latitude,
          longitude: label.longitude,
        }
      : {
          type: "btsearch:lookup",
          stationId: label.stationId,
        };

  try {
    const response: BTSearchLookupResponse = await browser.runtime.sendMessage(message);
    return {
      ...label,
      stationId: response.stationId ?? label.stationId,
      btSearchStatus: response.status,
    };
  } catch {
    return { ...label, btSearchStatus: "error" };
  }
}

function dispatchLabels(bridgeElement: HTMLScriptElement | undefined, labels: StationLabel[], options: LabelDisplayOptions): void {
  const payload: LabelsUpdatePayload = { labels, options };
  bridgeElement?.dispatchEvent(
    new CustomEvent(LABELS_UPDATE_EVENT, {
      detail: JSON.stringify(payload),
    }),
  );
}
