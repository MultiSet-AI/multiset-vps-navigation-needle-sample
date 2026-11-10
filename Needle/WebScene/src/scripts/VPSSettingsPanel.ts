/**
 * A runtime settings panel for MultiSet VPS: toggle localization options during an AR
 * session and see what the last query did.
 *
 * THIS FILE IS YOURS. It is sample code, not package code. VPSSettings.ts wires it to the
 * SDK; this file only draws controls and reports changes, so it has no SDK or Needle import
 * and you can restyle or replace it freely.
 *
 * Plain DOM for the same reason as NavigationPanel: the SDK owns the WebXR session, so taps
 * reach the session's dom-overlay root and never a Unity Canvas.
 */

/** The settings the SDK can change while a session runs. */
export interface IVPSRuntimeSettings {
  occlusion: boolean;
  showMesh: boolean;
  deepSearch: boolean;
  /** 1–5, or 0 for the server default. */
  searchDepth: number;
  queryModeFallback: boolean;
  useLastPoseAsHint: boolean;
  multiFrame: boolean;
}

export type VPSSettingChange = {
  [K in keyof IVPSRuntimeSettings]: { key: K; value: IVPSRuntimeSettings[K] };
}[keyof IVPSRuntimeSettings];

export type VPSStatusTone = 'info' | 'success' | 'error';

export interface IVPSSettingsPanelOptions {
  /** Where to mount. Pass the session's dom-overlay root so taps work during AR. */
  container?: HTMLElement;
  /** Starting values, normally the Inspector values. */
  initial: IVPSRuntimeSettings;
  /** Settings that only apply when a session or mesh starts, shown read-only. */
  startupOnly?: Array<{ label: string; value: string }>;
  /** Pin the panel to the top-left corner instead of the top-right. Default false. */
  alignLeft?: boolean;
  /** Start as a small button. Default true. */
  startCollapsed?: boolean;
  /** Called for every control change. Throw to have the panel show the error. */
  onChange: (change: VPSSettingChange) => void;
  /** Runs a localization now. */
  onLocalize: () => Promise<void>;
  /** Clears hint position, radius and floor height. */
  onClearHints: () => void;
}

const CSS_PREFIX = 'msvps-settings';
const STYLE_ELEMENT_ID = 'msvps-settings-styles';

export class VPSSettingsPanel {
  private readonly _opts: IVPSSettingsPanelOptions;
  private readonly _settings: IVPSRuntimeSettings;
  private readonly _root: HTMLDivElement;
  private readonly _toggle: HTMLButtonElement;
  private readonly _panel: HTMLDivElement;
  private readonly _status: HTMLDivElement;
  private readonly _localizeButton: HTMLButtonElement;
  private _sessionActive = false;
  private _localizing = false;

  constructor(options: IVPSSettingsPanelOptions) {
    this._opts = options;
    this._settings = { ...options.initial };
    const container = options.container ?? document.body;
    const doc = container.ownerDocument ?? document;
    injectStyles(doc);

    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      return node;
    };

    this._root = el('div', CSS_PREFIX);
    if (options.alignLeft) this._root.classList.add(`${CSS_PREFIX}--left`);

    this._toggle = el('button', `${CSS_PREFIX}-toggle ${CSS_PREFIX}-surface`);
    this._toggle.textContent = '⚙';
    this._toggle.setAttribute('aria-label', 'VPS settings');
    this._toggle.addEventListener('click', () => this.setOpen(this._panel.hidden));
    this._root.appendChild(this._toggle);

    this._panel = el('div', `${CSS_PREFIX}-panel ${CSS_PREFIX}-surface`);
    this._root.appendChild(this._panel);

    const head = el('div', `${CSS_PREFIX}-head`);
    head.textContent = 'VPS settings';
    const close = el('button', `${CSS_PREFIX}-close`);
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.setOpen(false));
    head.appendChild(close);
    this._panel.appendChild(head);

    const section = (title: string) => {
      const heading = el('div', `${CSS_PREFIX}-section`);
      heading.textContent = title;
      this._panel.appendChild(heading);
    };

    const checkbox = (key: 'occlusion' | 'showMesh' | 'deepSearch' | 'queryModeFallback' | 'useLastPoseAsHint' | 'multiFrame', label: string) => {
      const row = el('label', `${CSS_PREFIX}-row`);
      const input = el('input');
      input.type = 'checkbox';
      input.checked = this._settings[key];
      input.addEventListener('change', () => {
        if (!this._apply({ key, value: input.checked })) input.checked = !input.checked;
      });
      const text = el('span');
      text.textContent = label;
      row.appendChild(text);
      row.appendChild(input);
      this._panel.appendChild(row);
    };

    section('Display');
    checkbox('occlusion', 'Occlusion');
    checkbox('showMesh', 'Show mesh');

    section('Search');
    checkbox('deepSearch', 'Deep search (VPS-2)');
    {
      const row = el('label', `${CSS_PREFIX}-row`);
      const text = el('span');
      text.textContent = 'Search depth';
      const select = el('select');
      for (const value of [0, 1, 2, 3, 4, 5]) {
        const option = el('option');
        option.value = String(value);
        option.textContent = value === 0 ? 'Default' : String(value);
        select.appendChild(option);
      }
      select.value = String(this._settings.searchDepth);
      select.addEventListener('change', () => {
        const previous = this._settings.searchDepth;
        if (!this._apply({ key: 'searchDepth', value: Number(select.value) })) select.value = String(previous);
      });
      row.appendChild(text);
      row.appendChild(select);
      this._panel.appendChild(row);
    }
    checkbox('queryModeFallback', 'Fall back to VPS-2');

    section('Hints');
    checkbox('useLastPoseAsHint', 'Use last pose as hint');
    const clearHints = el('button', `${CSS_PREFIX}-action`);
    clearHints.textContent = 'Clear hints';
    clearHints.addEventListener('click', () => {
      try {
        options.onClearHints();
        this.setStatus('Hints cleared.', 'info');
      } catch (err) {
        this.setStatus(errorText(err), 'error');
      }
    });
    this._panel.appendChild(clearHints);

    section('Capture');
    checkbox('multiFrame', 'Multi-frame');

    if (options.startupOnly?.length) {
      section('Set in the Inspector');
      for (const item of options.startupOnly) {
        const row = el('div', `${CSS_PREFIX}-row ${CSS_PREFIX}-readonly`);
        const label = el('span');
        label.textContent = item.label;
        const value = el('span');
        value.textContent = item.value;
        row.appendChild(label);
        row.appendChild(value);
        this._panel.appendChild(row);
      }
    }

    this._localizeButton = el('button', `${CSS_PREFIX}-action ${CSS_PREFIX}-primary`);
    this._localizeButton.textContent = 'Localize now';
    this._localizeButton.addEventListener('click', () => { void this._localize(); });
    this._panel.appendChild(this._localizeButton);

    this._status = el('div', `${CSS_PREFIX}-status`);
    this._status.setAttribute('role', 'status');
    this._panel.appendChild(this._status);

    this.setOpen(options.startCollapsed === false);
    this.setSessionActive(false);
    this.setStatus('Changes apply to the next localization.', 'info');
    container.appendChild(this._root);
  }

  /** The values the panel currently shows. */
  get settings(): Readonly<IVPSRuntimeSettings> { return this._settings; }

  setOpen(open: boolean): void {
    this._panel.hidden = !open;
    this._toggle.hidden = open;
  }

  /** Localize now needs a running session. */
  setSessionActive(active: boolean): void {
    this._sessionActive = active;
    this._refreshLocalizeButton();
  }

  setLocalizing(localizing: boolean): void {
    this._localizing = localizing;
    this._refreshLocalizeButton();
  }

  setStatus(text: string, tone: VPSStatusTone): void {
    this._status.textContent = text;
    this._status.dataset.tone = tone;
  }

  dispose(): void {
    this._root.remove();
  }

  private _apply(change: VPSSettingChange): boolean {
    try {
      this._opts.onChange(change);
    } catch (err) {
      this.setStatus(errorText(err), 'error');
      return false;
    }
    (this._settings as unknown as Record<string, unknown>)[change.key] = change.value;
    this.setStatus(`${change.key} → ${describe(change.value)}. Applies to the next localization.`, 'info');
    return true;
  }

  private async _localize(): Promise<void> {
    if (!this._sessionActive || this._localizing) return;
    this.setLocalizing(true);
    this.setStatus(this._settings.multiFrame ? 'Capturing frames… hold still.' : 'Localizing…', 'info');
    try {
      await this._opts.onLocalize();
    } catch (err) {
      this.setStatus(errorText(err), 'error');
    } finally {
      this.setLocalizing(false);
    }
  }

  private _refreshLocalizeButton(): void {
    this._localizeButton.disabled = !this._sessionActive || this._localizing;
    this._localizeButton.textContent = !this._sessionActive
      ? 'Localize now (start AR first)'
      : this._localizing ? 'Localizing…' : 'Localize now';
  }
}

function describe(value: boolean | number): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return value === 0 ? 'default' : String(value);
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Inject the panel's stylesheet once per document. Everything is scoped under
 * .msvps-settings, and the look matches NavigationPanel and the MultisetVPS buttons.
 */
function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

const CSS = `
.${CSS_PREFIX} {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0px));
  right: calc(16px + env(safe-area-inset-right, 0px));
  z-index: 10000;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 14px;
  color: #fff;
  -webkit-tap-highlight-color: transparent;
}
.${CSS_PREFIX}--left {
  right: auto;
  left: calc(16px + env(safe-area-inset-left, 0px));
}
.${CSS_PREFIX} button,
.${CSS_PREFIX} select,
.${CSS_PREFIX} input { font: inherit; color: inherit; }
.${CSS_PREFIX} [hidden] { display: none !important; }

.${CSS_PREFIX}-surface {
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 12px;
}

.${CSS_PREFIX}-toggle {
  width: 44px; height: 44px;
  font-size: 22px; line-height: 1;
  cursor: pointer;
}

.${CSS_PREFIX}-panel {
  width: min(300px, calc(100vw - 32px));
  max-height: min(75vh, 560px);
  overflow-y: auto;
  padding: 4px 14px 14px;
  box-sizing: border-box;
}

.${CSS_PREFIX}-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0;
  font-weight: 600; letter-spacing: 0.04em;
  border-bottom: 1px solid rgba(255,255,255,0.18);
}
.${CSS_PREFIX}-close {
  background: none; border: none; cursor: pointer;
  font-size: 16px; padding: 6px 2px 6px 12px;
}

.${CSS_PREFIX}-section {
  margin: 14px 0 4px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; opacity: 0.6;
}

.${CSS_PREFIX}-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 36px;
}
.${CSS_PREFIX}-row input[type=checkbox] { width: 20px; height: 20px; accent-color: #33ccff; }
.${CSS_PREFIX}-row select {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 6px; padding: 4px 8px;
}
.${CSS_PREFIX}-row select option { color: #000; }
.${CSS_PREFIX}-readonly { opacity: 0.7; min-height: 28px; font-size: 13px; }

.${CSS_PREFIX}-action {
  display: block; width: 100%;
  margin-top: 8px; padding: 10px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 8px;
  cursor: pointer;
}
.${CSS_PREFIX}-primary {
  margin-top: 16px;
  font-weight: 600; letter-spacing: 0.04em;
  border-color: rgba(255,255,255,0.85);
}
.${CSS_PREFIX}-action:disabled { opacity: 0.45; cursor: default; }

.${CSS_PREFIX}-status {
  margin-top: 10px;
  font-size: 12px; line-height: 1.4;
  word-break: break-word;
}
.${CSS_PREFIX}-status[data-tone=success] { color: #7dffa8; }
.${CSS_PREFIX}-status[data-tone=error] { color: #ff8a8a; }
`;
