import { type SubmitEvent, useEffect, useId, useReducer } from "react";

import { DEFAULT_LABEL_DISPLAY_OPTIONS, DEFAULT_THEME_MODE, type LabelDisplayOptions, type ThemeMode } from "@/lib/messages.ts";
import { btSearchApiKey, extensionEnabled, labelDisplayOptions, themeMode } from "@/lib/settings.ts";
import { cn } from "@/lib/utils.ts";

interface SettingSwitchProps {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

type ToggleableDisplayOption = "showCoordinates" | "showDSS" | "showBTSearchStatus";

interface PopupState {
  apiKey: string;
  enabled: boolean;
  theme: ThemeMode;
  displayOptions: LabelDisplayOptions;
  initializing: boolean;
  saving: boolean;
  savingTheme: boolean;
  saved: boolean;
  error: string;
}

type PopupStatePatch = Partial<PopupState> | ((state: Readonly<PopupState>) => Partial<PopupState>);

const AZIMUTH_MODES = [
  { value: "per-band", label: "Na pasmo" },
  { value: "overall", label: "Łącznie" },
] as const satisfies ReadonlyArray<{ value: LabelDisplayOptions["azimuthMode"]; label: string }>;

const INITIAL_POPUP_STATE: PopupState = {
  apiKey: "",
  enabled: true,
  theme: DEFAULT_THEME_MODE,
  displayOptions: DEFAULT_LABEL_DISPLAY_OPTIONS,
  initializing: true,
  saving: false,
  savingTheme: false,
  saved: false,
  error: "",
};

function applyPopupStatePatch(state: PopupState, patch: PopupStatePatch): PopupState {
  const changes = typeof patch === "function" ? patch(state) : patch;
  return { ...state, ...changes };
}

function SettingSwitch({ title, description, checked, disabled, onToggle }: SettingSwitchProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-2.5">
      <span className="min-w-0">
        <strong className="block text-xs font-semibold" id={titleId}>
          {title}
        </strong>
        <small className="mt-0.5 block text-[10px] leading-4 text-[var(--popup-muted)]" id={descriptionId}>
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
          className={cn(
            "absolute left-0 top-0.75 h-4.5 w-8 rounded-full transition-colors",
            checked ? "bg-[#e20074]" : "bg-[var(--popup-switch-off)]",
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute left-px top-px size-4 rounded-full bg-[var(--popup-switch-thumb)] shadow-[0_1px_2px_rgba(4,8,11,0.22)] transition-transform",
              checked ? "translate-x-3.5" : "translate-x-0",
            )}
          />
        </span>
      </button>
    </div>
  );
}

function App() {
  const idPrefix = useId();
  const [state, patchState] = useReducer(applyPopupStatePatch, INITIAL_POPUP_STATE);
  const { apiKey, enabled, theme, displayOptions, initializing, saving, savingTheme, saved, error } = state;
  const busy = initializing || saving || savingTheme;
  const displayControlsDisabled = busy || !enabled;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const [storedApiKey, storedEnabled, storedDisplayOptions, storedTheme] = await Promise.all([
          btSearchApiKey.getValue(),
          extensionEnabled.getValue(),
          labelDisplayOptions.getValue(),
          themeMode.getValue(),
        ]);

        if (!active) return;

        patchState({
          apiKey: storedApiKey,
          enabled: storedEnabled,
          displayOptions: storedDisplayOptions,
          theme: storedTheme,
          initializing: false,
        });
      } catch {
        if (active) patchState({ error: "Błąd odczytu", initializing: false });
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const saveSettings = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    patchState({ saving: true, saved: false, error: "" });

    try {
      await Promise.all([btSearchApiKey.setValue(apiKey.trim()), extensionEnabled.setValue(enabled), labelDisplayOptions.setValue(displayOptions)]);
      patchState({ saved: true, saving: false });
    } catch {
      patchState({ error: "Błąd zapisu", saving: false });
    }
  };

  const selectAzimuthMode = (azimuthMode: LabelDisplayOptions["azimuthMode"]) => {
    patchState(({ displayOptions }) => ({
      displayOptions: { ...displayOptions, azimuthMode },
      saved: false,
    }));
  };

  const toggleDisplayOption = (option: ToggleableDisplayOption) => {
    patchState(({ displayOptions }) => ({
      displayOptions: { ...displayOptions, [option]: !displayOptions[option] },
      saved: false,
    }));
  };

  const toggleTheme = async () => {
    const previousTheme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    patchState({ theme: nextTheme, savingTheme: true, saved: false, error: "" });

    try {
      await themeMode.setValue(nextTheme);
      patchState({ savingTheme: false });
    } catch {
      patchState({ theme: previousTheme, error: "Błąd zapisu trybu ciemnego", savingTheme: false });
    }
  };

  return (
    <main className="w-[320px] bg-[var(--popup-canvas)] text-[var(--popup-text)]">
      <header className="px-4 py-3.5">
        <h1 className="text-base font-bold tracking-[-0.015em]" aria-label="Mapa T-Mobile Plus">
          Mapa T-Mobile
          <span className="relative -top-px ml-0.5 inline-block text-[1.45em] font-black leading-none text-[#e20074]" aria-hidden="true">
            +
          </span>
        </h1>
        <p className="mt-0.5 text-[10px] leading-none text-[var(--popup-muted)]">Rozszerzenie mapy nadajników T-Mobile o dodatkowe opcje</p>
      </header>

      <form className="border-t border-[var(--popup-border)]" onSubmit={saveSettings}>
        <div className={cn("border-b border-[var(--popup-border)] transition-opacity", busy && "opacity-50")}>
          <SettingSwitch
            title="Tryb ciemny"
            description="Strona, mapa i etykiety"
            checked={theme === "dark"}
            disabled={busy}
            onToggle={() => void toggleTheme()}
          />
        </div>

        <div className={cn("border-b border-[var(--popup-border)] transition-opacity", busy && "opacity-50")}>
          <SettingSwitch
            title="Etykiety na mapie"
            description="Włącz labele nad stacjami"
            checked={enabled}
            disabled={busy}
            onToggle={() => patchState(({ enabled }) => ({ enabled: !enabled, saved: false }))}
          />
        </div>

        <fieldset
          className={cn("border-b border-[var(--popup-border)] transition-opacity", displayControlsDisabled && "opacity-50")}
          disabled={displayControlsDisabled}
        >
          <legend className="sr-only">Wygląd etykiet</legend>
          <div className="border-b border-[var(--popup-border)] px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold" id={`${idPrefix}-azimuth-title`}>
              Azymuty
            </p>
            <div
              className="grid grid-cols-2 rounded-[10px] border border-[var(--popup-border)] bg-[var(--popup-subtle)] p-0.5"
              role="radiogroup"
              aria-labelledby={`${idPrefix}-azimuth-title`}
            >
              {AZIMUTH_MODES.map((mode) => (
                <label className={displayControlsDisabled ? "cursor-not-allowed" : "cursor-pointer"} key={mode.value}>
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="azimuth-mode"
                    value={mode.value}
                    checked={displayOptions.azimuthMode === mode.value}
                    onChange={() => selectAzimuthMode(mode.value)}
                  />
                  <span
                    className={cn(
                      "flex h-7 items-center justify-center rounded-lg text-[11px] transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#e20074]/30",
                      displayOptions.azimuthMode === mode.value ? "bg-[#e20074] font-bold text-white" : "font-medium text-[var(--popup-muted)]",
                    )}
                  >
                    {mode.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[var(--popup-border)]">
            <SettingSwitch
              title="Współrzędne"
              description="GPS stacji"
              checked={displayOptions.showCoordinates}
              disabled={displayControlsDisabled}
              onToggle={() => toggleDisplayOption("showCoordinates")}
            />
            <SettingSwitch
              title="DSS"
              description="Pokazuje czy stacja ma pasmo 2100MHz (LTE/NR)"
              checked={displayOptions.showDSS}
              disabled={displayControlsDisabled}
              onToggle={() => toggleDisplayOption("showDSS")}
            />
            <SettingSwitch
              title="Status BTSearch"
              description="Znaleziono / brak"
              checked={displayOptions.showBTSearchStatus}
              disabled={displayControlsDisabled}
              onToggle={() => toggleDisplayOption("showBTSearchStatus")}
            />
          </div>
        </fieldset>

        <div className="px-4 py-3.5">
          <label className="mb-1.5 block text-[11px] font-semibold" htmlFor={`${idPrefix}-api-key`}>
            Klucz API BTSearch
          </label>
          <input
            className="block h-8 w-full rounded-[10px] border border-[var(--popup-border)] bg-[var(--popup-input)] px-2.5 font-mono text-xs text-[var(--popup-text)] caret-[#e20074] outline-none transition-shadow placeholder:text-[var(--popup-placeholder)] focus:border-[#e20074] focus:ring-[3px] focus:ring-[#e20074]/15 disabled:cursor-not-allowed disabled:opacity-50"
            id={`${idPrefix}-api-key`}
            aria-describedby={`${idPrefix}-api-key-help`}
            type="password"
            value={apiKey}
            disabled={busy}
            onChange={(event) => patchState({ apiKey: event.target.value, saved: false })}
            placeholder="sk_"
            spellCheck={false}
            autoComplete="off"
          />
          <small className="mt-1.5 block text-[10px] leading-4 text-[var(--popup-muted)]" id={`${idPrefix}-api-key-help`}>
            Puste pole wyłączy funkcje sprawdzania czy stacja istnieje w BTSearch.
          </small>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--popup-border)] px-4 py-3">
          <p
            className={cn("min-h-4 text-[10px] font-semibold", error ? "text-[var(--popup-danger)]" : "text-[#e20074]")}
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

      <footer className="border-t border-[var(--popup-border)] bg-[var(--popup-subtle)] px-4 py-2 text-center text-[10px] text-[var(--popup-muted)]">
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
