import { type FormEvent, useEffect, useId, useState } from "react";

import { DEFAULT_LABEL_DISPLAY_OPTIONS, type LabelDisplayOptions } from "@/lib/messages";
import { btSearchApiKey, extensionEnabled, labelDisplayOptions } from "@/lib/settings";
import { cn } from "@/lib/utils";

interface SettingSwitchProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

function SettingSwitch({ id, title, description, checked, disabled, onToggle }: SettingSwitchProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2.5">
      <span className="min-w-0">
        <strong className="block text-xs font-semibold" id={titleId}>
          {title}
        </strong>
        <small className="mt-0.5 block text-[10px] leading-4 text-[#636a6d]" id={descriptionId}>
          {description}
        </small>
      </span>
      <button
        className="relative h-6 w-8 shrink-0 rounded-full bg-transparent outline-none focus-visible:ring-[3px] focus-visible:ring-[#e20074]/30 disabled:cursor-not-allowed"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={onToggle}
      >
        <span
          className={cn("absolute left-0 top-0.75 h-4.5 w-8 rounded-full transition-colors", checked ? "bg-[#e20074]" : "bg-[#dde2e4]")}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute left-px top-px size-4 rounded-full bg-[#fafcfd] shadow-[0_1px_2px_rgba(4,8,11,0.22)] transition-transform",
              checked ? "translate-x-3.5" : "translate-x-0",
            )}
          />
        </span>
      </button>
    </div>
  );
}

function App() {
  const apiKeyId = useId();
  const apiKeyHelpId = useId();
  const masterSwitchId = useId();
  const azimuthTitleId = useId();
  const coordinatesSwitchId = useId();
  const showDSSSwitchId = useId();
  const statusSwitchId = useId();
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [displayOptions, setDisplayOptions] = useState<LabelDisplayOptions>({
    ...DEFAULT_LABEL_DISPLAY_OPTIONS,
  });
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const busy = initializing || saving;
  const displayControlsDisabled = busy || !enabled;

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const [storedApiKey, storedEnabled, storedDisplayOptions] = await Promise.all([
          btSearchApiKey.getValue(),
          extensionEnabled.getValue(),
          labelDisplayOptions.getValue(),
        ]);

        if (!active) return;

        setApiKey(storedApiKey);
        setEnabled(storedEnabled);
        setDisplayOptions(storedDisplayOptions);
      } catch {
        if (active) setError("Błąd odczytu");
      } finally {
        if (active) setInitializing(false);
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      await Promise.all([btSearchApiKey.setValue(apiKey.trim()), extensionEnabled.setValue(enabled), labelDisplayOptions.setValue(displayOptions)]);
      setSaved(true);
    } catch {
      setError("Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  const selectAzimuthMode = (azimuthMode: LabelDisplayOptions["azimuthMode"]) => {
    setDisplayOptions((current) => ({ ...current, azimuthMode }));
    setSaved(false);
  };

  return (
    <main className="w-[320px] bg-[#fafcfd] text-[#04080b]">
      <header className="px-4 py-3.5">
        <h1 className="text-base font-bold tracking-[-0.015em]" aria-label="Mapa T-Mobile Plus">
          Mapa T-Mobile
          <span className="relative -top-px ml-0.5 inline-block text-[1.45em] font-black leading-none text-[#e20074]" aria-hidden="true">
            +
          </span>
        </h1>
        <p className="mt-0.5 text-[10px] leading-none text-[#636a6d]">Rozszerzenie mapy nadajników T-Mobile o dodatkowe opcje</p>
      </header>

      <form className="border-t border-[#dde2e4]" onSubmit={saveSettings}>
        <div className={cn("border-b border-[#dde2e4] transition-opacity", busy && "opacity-50")}>
          <SettingSwitch
            id={masterSwitchId}
            title="Etykiety na mapie"
            description="Włącz labele nad stacjami"
            checked={enabled}
            disabled={busy}
            onToggle={() => {
              setEnabled((current) => !current);
              setSaved(false);
            }}
          />
        </div>

        <fieldset
          className={cn("border-b border-[#dde2e4] transition-opacity", displayControlsDisabled && "opacity-50")}
          disabled={displayControlsDisabled}
        >
          <legend className="sr-only">Wygląd etykiet</legend>
          <div className="border-b border-[#dde2e4] px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold" id={azimuthTitleId}>
              Azymuty
            </p>
            <div
              className="grid grid-cols-2 rounded-[10px] border border-[#dde2e4] bg-[#eef3f5] p-0.5"
              role="radiogroup"
              aria-labelledby={azimuthTitleId}
            >
              <label className={displayControlsDisabled ? "cursor-not-allowed" : "cursor-pointer"}>
                <input
                  className="peer sr-only"
                  type="radio"
                  name="azimuth-mode"
                  value="per-band"
                  checked={displayOptions.azimuthMode === "per-band"}
                  disabled={displayControlsDisabled}
                  onChange={() => selectAzimuthMode("per-band")}
                />
                <span
                  className={cn(
                    "flex h-7 items-center justify-center rounded-lg text-[11px] transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#e20074]/30",
                    displayOptions.azimuthMode === "per-band" ? "bg-[#e20074] font-bold text-white" : "font-medium text-[#636a6d]",
                  )}
                >
                  Na pasmo
                </span>
              </label>
              <label className={displayControlsDisabled ? "cursor-not-allowed" : "cursor-pointer"}>
                <input
                  className="peer sr-only"
                  type="radio"
                  name="azimuth-mode"
                  value="overall"
                  checked={displayOptions.azimuthMode === "overall"}
                  disabled={displayControlsDisabled}
                  onChange={() => selectAzimuthMode("overall")}
                />
                <span
                  className={cn(
                    "flex h-7 items-center justify-center rounded-lg text-[11px] transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#e20074]/30",
                    displayOptions.azimuthMode === "overall" ? "bg-[#e20074] font-bold text-white" : "font-medium text-[#636a6d]",
                  )}
                >
                  Łącznie
                </span>
              </label>
            </div>
          </div>

          <div className="divide-y divide-[#dde2e4]">
            <SettingSwitch
              id={coordinatesSwitchId}
              title="Współrzędne"
              description="GPS stacji"
              checked={displayOptions.showCoordinates}
              disabled={displayControlsDisabled}
              onToggle={() => {
                setDisplayOptions((current) => ({
                  ...current,
                  showCoordinates: !current.showCoordinates,
                }));
                setSaved(false);
              }}
            />
            <SettingSwitch
              id={showDSSSwitchId}
              title="DSS"
              description="Prawdopodobnie pokazuje czy dana stacja ma sygnalizację 5G"
              checked={displayOptions.showDSS}
              disabled={displayControlsDisabled}
              onToggle={() => {
                setDisplayOptions((current) => ({
                  ...current,
                  showDSS: !current.showDSS,
                }));
                setSaved(false);
              }}
            />
            <SettingSwitch
              id={statusSwitchId}
              title="Status BTSearch"
              description="Znaleziono / brak"
              checked={displayOptions.showBTSearchStatus}
              disabled={displayControlsDisabled}
              onToggle={() => {
                setDisplayOptions((current) => ({
                  ...current,
                  showBTSearchStatus: !current.showBTSearchStatus,
                }));
                setSaved(false);
              }}
            />
          </div>
        </fieldset>

        <div className="px-4 py-3.5">
          <label className="mb-1.5 block text-[11px] font-semibold" htmlFor={apiKeyId}>
            Klucz API BTSearch
          </label>
          <input
            className="block h-8 w-full rounded-[10px] border border-[#dde2e4] bg-transparent px-2.5 font-mono text-xs text-[#04080b] outline-none transition-shadow placeholder:text-[#8b9295] focus:border-[#e20074] focus:ring-[3px] focus:ring-[#e20074]/15 disabled:cursor-not-allowed disabled:opacity-50"
            id={apiKeyId}
            aria-describedby={apiKeyHelpId}
            type="password"
            value={apiKey}
            disabled={busy}
            onChange={(event) => {
              setApiKey(event.target.value);
              setSaved(false);
            }}
            placeholder="sk_"
            spellCheck={false}
            autoComplete="off"
          />
          <small className="mt-1.5 block text-[10px] leading-4 text-[#636a6d]" id={apiKeyHelpId}>
            Puste pole wyłączy funkcje sprawdzania czy stacja istnieje w BTSearch.
          </small>
        </div>

        <div className="flex items-center justify-between border-t border-[#dde2e4] px-4 py-3">
          <p
            className={cn("min-h-4 text-[10px] font-semibold", error ? "text-[#b42318]" : "text-[#e20074]")}
            aria-live="polite"
            role={error ? "alert" : undefined}
          >
            {error || (saved ? "Zapisano" : "")}
          </p>
          <button
            className="h-8 rounded-[10px] bg-[#e20074] px-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-[#c90068] focus-visible:ring-[3px] focus-visible:ring-[#e20074]/30 disabled:cursor-wait disabled:opacity-50"
            type="submit"
            disabled={busy}
          >
            {initializing ? "Ładowanie..." : saving ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>
      </form>

      <footer className="border-t border-[#dde2e4] bg-[#eef3f5]/60 px-4 py-2 text-center text-[10px] text-[#636a6d]">
        from{" "}
        <a
          className="rounded-sm font-bold text-[#e20074] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#e20074]/30"
          href="https://btsearch.pl"
          target="_blank"
          rel="noreferrer"
        >
          BTSearch
        </a>{" "}
        developer
      </footer>
    </main>
  );
}

export default App;
