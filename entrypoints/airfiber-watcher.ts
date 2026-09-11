import overlayStyles from "@/assets/airfiber-overlay.css?inline";
import type { BandDetails } from "@/lib/airfiber.ts";
import {
  createLabelsSignature,
  formatBandDetails,
  formatCoordinates,
  formatOverallAzimuths,
  formatSectorCount,
  isLabelsUpdatePayload,
  isPicocell,
} from "@/lib/label-display.ts";
import {
  type BTSearchStatus,
  CELL_RESPONSE_EVENT,
  DEFAULT_LABEL_DISPLAY_OPTIONS,
  DEFAULT_THEME_MODE,
  LABELS_UPDATE_EVENT,
  type LabelDisplayOptions,
  type LabelsUpdatePayload,
  type StationLabel,
} from "@/lib/messages.ts";
import { isRecord } from "@/lib/utils.ts";

interface MapPoint {
  x: number;
  y: number;
}

interface MapPanes {
  floatPane: HTMLElement;
}

interface MapProjection {
  fromLatLngToDivPixel(position: unknown): MapPoint | null;
}

interface OverlayViewInstance {
  draw?(): void;
  setMap(map: unknown): void;
  getPanes(): MapPanes | null;
  getProjection(): MapProjection;
}

type UnknownConstructor = new (...args: unknown[]) => unknown;
type OverlayViewConstructor = new () => OverlayViewInstance;
type LatLngConstructor = new (latitude: number, longitude: number) => unknown;

interface MapsNamespace {
  Map?: UnknownConstructor;
  Marker?: UnknownConstructor;
  OverlayView?: OverlayViewConstructor;
  LatLng?: LatLngConstructor;
}

interface InstrumentedWindow extends Window {
  google?: { maps?: MapsNamespace };
  __tmobilePlusInstalled__?: boolean;
}

interface MapBearingObject {
  addListener?: (eventName: string, handler: () => void) => unknown;
  getMap?: () => unknown;
  getPosition?: () => { lat: () => number; lng: () => number } | null;
  getVisible?: () => boolean;
  setMap?: (map: unknown) => void;
}

interface ThemedMap {
  get?: (propertyName: string) => unknown;
  setOptions?: (options: MapOptions) => void;
}

interface MapOptions extends Record<string, unknown> {
  styles?: unknown;
}

interface MapStyleRule {
  featureType?: string;
  elementType?: string;
  stylers: Array<Record<string, string>>;
}

const DARK_MAP_STYLES: MapStyleRule[] = [
  { elementType: "geometry", stylers: [{ color: "#000000" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#242424" }] },
  { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#080808" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#07100b" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9dac9e" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#07140c" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9bbba7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#171717" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cccccc" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#242424" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#333333" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#3b2633" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#111111" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#111820" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#001523" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8eb8cf" }] },
];

export default defineUnlistedScript(() => {
  const pageWindow = window as unknown as InstrumentedWindow;
  const bridgeElement = document.currentScript;
  if (!(bridgeElement instanceof HTMLScriptElement)) return;

  if (pageWindow.__tmobilePlusInstalled__ === true) return;

  pageWindow.__tmobilePlusInstalled__ = true;

  let currentMap: unknown;
  let labels: StationLabel[] = [];
  let displayOptions = DEFAULT_LABEL_DISPLAY_OPTIONS;
  let theme = DEFAULT_THEME_MODE;
  let overlay: OverlayViewInstance | undefined;
  let originalMapStyles: unknown;
  let setCurrentMapOptions: ((options: MapOptions) => void) | undefined;
  const markers = new Map<string, Set<MapBearingObject>>();
  let mapConstructorPatched = false;
  let markerConstructorPatched = false;

  bridgeElement.addEventListener(LABELS_UPDATE_EVENT, (event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;

    const payload = parseLabelsUpdatePayload(event.detail);
    if (payload === null) return;

    labels = payload.labels;
    displayOptions = payload.options;
    theme = payload.theme;
    applyMapTheme();
    renderOverlay();
  });

  const originalFetch = pageWindow.fetch.bind(pageWindow);
  pageWindow.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (isAirfiberRequest(input)) {
      void response
        .clone()
        .json()
        .then((payload: unknown) => {
          bridgeElement.dispatchEvent(
            new CustomEvent(CELL_RESPONSE_EVENT, {
              detail: JSON.stringify(payload),
            }),
          );
        })
        .catch((error: unknown) => {
          console.warn("[Mapa T-Mobile+] Nie udało się odczytać odpowiedzi AirFiber:", error);
        });
    }

    return response;
  };

  document.addEventListener(
    "load",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLScriptElement)) return;

      if (target.id === "airfiber-map" || target.src.includes("maps.googleapis.com")) patchMapsConstructors();
    },
    true,
  );

  const patchTimer = window.setInterval(patchMapsConstructors, 20);
  window.setTimeout(() => window.clearInterval(patchTimer), 30_000);
  patchMapsConstructors();

  function patchMapsConstructors(): void {
    const maps = pageWindow.google?.maps;
    if (maps === undefined) return;

    if (!mapConstructorPatched && maps.Map !== undefined) {
      maps.Map = wrapConstructor(maps.Map, captureMap);
      mapConstructorPatched = true;
    }

    if (!markerConstructorPatched && maps.Marker !== undefined) {
      maps.Marker = wrapConstructor(maps.Marker, (instance, args) => {
        const marker = instance as MapBearingObject;
        const options = args[0];
        captureMap(marker.getMap?.() ?? (isRecord(options) ? options.map : undefined));
        trackMarker(marker);
      });
      markerConstructorPatched = true;
    }

    if (mapConstructorPatched && markerConstructorPatched) window.clearInterval(patchTimer);
  }

  function captureMap(map: unknown): void {
    if (map === undefined || map === null || map === currentMap) return;

    currentMap = map;
    const themedMap = map as ThemedMap;
    originalMapStyles = themedMap.get?.("styles");
    const originalSetOptions = themedMap.setOptions?.bind(themedMap);
    setCurrentMapOptions = originalSetOptions;

    if (originalSetOptions !== undefined) {
      themedMap.setOptions = (options) => {
        if (!Object.prototype.hasOwnProperty.call(options, "styles")) {
          originalSetOptions(options);
          return;
        }

        originalMapStyles = options.styles;
        originalSetOptions(theme === "dark" ? { ...options, styles: DARK_MAP_STYLES } : options);
      };
    }

    overlay?.setMap(null);
    overlay = undefined;
    applyMapTheme();
    renderOverlay();
  }

  function applyMapTheme(): void {
    const styles = theme === "dark" ? DARK_MAP_STYLES : originalMapStyles;
    setCurrentMapOptions?.({ styles });
  }

  function renderOverlay(): void {
    if (currentMap === undefined) return;

    const maps = pageWindow.google?.maps;
    if (maps?.OverlayView === undefined || maps.LatLng === undefined) return;

    if (overlay === undefined) {
      overlay = createLabelsOverlay(maps.OverlayView, maps.LatLng, () => ({
        labels: labels.filter(hasVisibleMarker),
        options: displayOptions,
        theme,
      }));
      overlay.setMap(currentMap);
    }

    overlay.draw?.();
  }

  function scheduleOverlayRender(): void {
    window.queueMicrotask(renderOverlay);
  }

  function trackMarker(marker: MapBearingObject): void {
    const position = marker.getPosition?.();
    if (position === undefined || position === null) return;

    const key = createMarkerKey(position.lng(), position.lat());
    if (marker.getMap?.() !== null) addTrackedMarker(key, marker);

    const originalSetMap = marker.setMap?.bind(marker);
    if (originalSetMap !== undefined) {
      marker.setMap = (map) => {
        originalSetMap(map);
        if (map === null) removeTrackedMarker(key, marker);
        else {
          captureMap(map);
          addTrackedMarker(key, marker);
        }
        scheduleOverlayRender();
      };
    }

    marker.addListener?.("visible_changed", scheduleOverlayRender);
    scheduleOverlayRender();
  }

  function addTrackedMarker(key: string, marker: MapBearingObject): void {
    const coordinateMarkers = markers.get(key) ?? new Set<MapBearingObject>();
    coordinateMarkers.add(marker);
    markers.set(key, coordinateMarkers);
  }

  function removeTrackedMarker(key: string, marker: MapBearingObject): void {
    const coordinateMarkers = markers.get(key);
    if (coordinateMarkers === undefined) return;

    coordinateMarkers.delete(marker);
    if (coordinateMarkers.size === 0) markers.delete(key);
  }

  function hasVisibleMarker(label: StationLabel): boolean {
    const coordinateMarkers = markers.get(createMarkerKey(label.longitude, label.latitude));
    if (coordinateMarkers === undefined) return false;

    return [...coordinateMarkers].some((marker) => {
      const visible = marker.getVisible?.() ?? true;
      return visible && marker.getMap?.() === currentMap;
    });
  }
});

function createLabelsOverlay(
  OverlayView: OverlayViewConstructor,
  LatLng: LatLngConstructor,
  getPayload: () => LabelsUpdatePayload,
): OverlayViewInstance {
  return new (class extends OverlayView {
    private host: HTMLDivElement | null = null;
    private container: HTMLDivElement | null = null;
    private renderedSignature = "";

    onAdd(): void {
      const host = document.createElement("div");
      host.style.position = "absolute";
      host.style.left = "0";
      host.style.top = "0";
      host.style.zIndex = "1";

      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = overlayStyles;
      const container = document.createElement("div");
      shadow.append(style, container);

      this.host = host;
      this.container = container;
      this.getPanes()?.floatPane.append(host);
    }

    override draw(): void {
      const container = this.container;
      if (container === null) return;

      const { labels, options, theme } = getPayload();
      if (this.host !== null) this.host.dataset.theme = theme;

      const signature = createLabelsSignature({ labels, options, theme });
      if (signature !== this.renderedSignature) {
        this.renderedSignature = signature;
        container.replaceChildren(...labels.map((label) => createLabelElement(label, options)));
      }

      const projection = this.getProjection();
      labels.forEach((label, index) => {
        const point = projection.fromLatLngToDivPixel(new LatLng(label.latitude, label.longitude));
        const element = container.children.item(index);
        if (!(element instanceof HTMLElement)) return;

        if (point === null) {
          element.style.display = "none";
          return;
        }

        element.style.display = "";
        element.style.left = `${point.x}px`;
        element.style.top = `${point.y}px`;
      });
    }

    onRemove(): void {
      this.host?.remove();
      this.host = null;
      this.container = null;
      this.renderedSignature = "";
    }
  })();
}

function createLabelElement(label: StationLabel, options: LabelDisplayOptions): HTMLElement {
  const element = document.createElement("div");
  element.className = getLabelClassName(label);

  const summary = document.createElement("div");
  summary.className = "summary";
  const identity = document.createElement("span");
  identity.textContent = `${label.stationId ?? "-"} · ${formatSectorCount(label.sectorCount)}`;
  summary.append(identity);

  if (isPicocell(label.azimuths)) {
    const pico = document.createElement("span");
    pico.className = "pico";
    pico.textContent = "pico?";
    pico.title = "Picocell?";
    summary.append(pico);
  }

  if (options.showDSS && label.isDSSEnabled) {
    const dss = document.createElement("span");
    dss.className = "dss";
    dss.textContent = "DSS";
    dss.title = "Stacja posiada sygnalizację 5G";
    summary.append(dss);
  }

  if (options.showBTSearchStatus) {
    const status = createStatusElement(label.btSearchStatus);
    if (status !== null) summary.append(status);
  }

  const details = createBandRows(label, options.azimuthMode);
  if (options.azimuthMode === "overall" && label.azimuths.length > 0) details.push(createOverallAzimuthRow(label.azimuths));

  if (options.showCoordinates) {
    const coordinates = document.createElement("div");
    coordinates.className = "coordinates";
    coordinates.textContent = formatCoordinates(label.latitude, label.longitude);
    details.push(coordinates);
  }

  element.append(summary, ...details);
  return element;
}

function getLabelClassName(label: StationLabel): string {
  if (label.nrBands.some(({ band }) => band === "3600")) return "label plus";
  if (label.nrBands.length > 0) return "label nr";
  return "label";
}

function createStatusElement(status: StationLabel["btSearchStatus"]): HTMLElement | null {
  if (status === "unchecked" || status === "unconfigured") return null;

  const element = document.createElement("span");
  element.className = `status ${status}`;
  element.title = statusTitle(status);
  return element;
}

function statusTitle(status: BTSearchStatus): string {
  if (status === "found") return "Stacja znaleziona w BTSearch";
  if (status === "missing") return "Brak stacji w BTSearch";
  if (status === "error") return "Nie udało się sprawdzić BTSearch";
  return "Klucz API BTSearch nie jest skonfigurowany";
}

function createBandRows(label: StationLabel, azimuthMode: LabelDisplayOptions["azimuthMode"]): HTMLElement[] {
  const rows: HTMLElement[] = [];
  for (const band of label.lteBands) rows.push(createBandRow("LTE", band, azimuthMode === "per-band"));
  for (const band of label.nrBands) rows.push(createBandRow("NR", band, azimuthMode === "per-band"));

  if (rows.length > 0) return rows;

  const emptyRow = document.createElement("div");
  emptyRow.className = "band-row";
  emptyRow.textContent = "Pasma -";
  return [emptyRow];
}

function createBandRow(technology: string, bandDetails: BandDetails, showAzimuths: boolean): HTMLElement {
  const element = document.createElement("div");
  element.className = "band-row";
  element.textContent = formatBandDetails(technology, bandDetails, showAzimuths);
  element.title = element.textContent;
  return element;
}

function createOverallAzimuthRow(azimuths: number[]): HTMLElement {
  const element = document.createElement("div");
  element.className = "band-row overall-azimuths";
  element.textContent = formatOverallAzimuths(azimuths);
  return element;
}

function isAirfiberRequest(input: RequestInfo | URL): boolean {
  const url = input instanceof Request ? input.url : String(input);
  return url.includes("/api/trpc/") && url.includes("airfiber.cell");
}

function createMarkerKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
}

function wrapConstructor(original: UnknownConstructor, onInstance: (instance: unknown, args: unknown[]) => void): UnknownConstructor {
  const WrappedConstructor = function (this: unknown, ...args: unknown[]) {
    const instance = Reflect.construct(original, args);
    onInstance(instance, args);
    return instance;
  };

  WrappedConstructor.prototype = original.prototype;
  Object.setPrototypeOf(WrappedConstructor, original);
  return WrappedConstructor as unknown as UnknownConstructor;
}

function parseLabelsUpdatePayload(value: string): LabelsUpdatePayload | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isLabelsUpdatePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
