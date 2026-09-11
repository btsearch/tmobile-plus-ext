import "@/assets/content-theme.css";
import { parseAirfiberStations } from "@/lib/airfiber.ts";
import {
  type BTSearchLookupMessage,
  type BTSearchLookupResponse,
  CELL_RESPONSE_EVENT,
  DEFAULT_LABEL_DISPLAY_OPTIONS,
  DEFAULT_THEME_MODE,
  LABELS_UPDATE_EVENT,
  type LabelsUpdatePayload,
  type StationLabel,
  type ThemeMode,
} from "@/lib/messages.ts";
import { btSearchApiKey, extensionEnabled, labelDisplayOptions, themeMode } from "@/lib/settings.ts";

export default defineContentScript({
  matches: ["https://www.t-mobile.pl/mapa-nadajnikow*"],
  runAt: "document_start",

  async main() {
    let bridgeElement: HTMLScriptElement | undefined;
    let latestLabels: StationLabel[] = [];
    let labelsEnabled = true;
    let displayOptions = DEFAULT_LABEL_DISPLAY_OPTIONS;
    let theme = DEFAULT_THEME_MODE;
    let responseSequence = 0;

    function dispatchCurrentLabels(): void {
      const payload: LabelsUpdatePayload = {
        labels: labelsEnabled ? latestLabels : [],
        options: displayOptions,
        theme,
      };
      bridgeElement?.dispatchEvent(
        new CustomEvent(LABELS_UPDATE_EVENT, {
          detail: JSON.stringify(payload),
        }),
      );
    }

    function updateTheme(nextTheme: ThemeMode): void {
      theme = nextTheme;
      document.documentElement.dataset.tmobilePlusTheme = nextTheme;
    }

    function publishLabels(labels: StationLabel[]): void {
      latestLabels = labels;
      dispatchCurrentLabels();
    }

    function processPayload(payload: unknown): Promise<void> {
      const uncheckedLabels: StationLabel[] = parseAirfiberStations(payload).map((station) => ({
        ...station,
        btSearchStatus: "unchecked",
      }));
      return refreshLabels(uncheckedLabels);
    }

    async function refreshLabels(uncheckedLabels: StationLabel[]): Promise<void> {
      const sequence = ++responseSequence;
      publishLabels(uncheckedLabels);

      const enrichedLabels = await Promise.all(uncheckedLabels.map(enrichWithBTSearch));
      if (sequence !== responseSequence) return;

      publishLabels(enrichedLabels);
    }

    const settingsLoaded = Promise.all([extensionEnabled.getValue(), labelDisplayOptions.getValue(), themeMode.getValue()]).then(
      ([enabled, options, storedTheme]) => {
        labelsEnabled = enabled;
        displayOptions = options;
        updateTheme(storedTheme);
      },
    );

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

    themeMode.watch((nextTheme) => {
      updateTheme(nextTheme);
      dispatchCurrentLabels();
    });

    btSearchApiKey.watch(() => {
      const uncheckedLabels = latestLabels.map((label) => ({
        ...label,
        btSearchStatus: "unchecked" as const,
      }));
      void refreshLabels(uncheckedLabels);
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
