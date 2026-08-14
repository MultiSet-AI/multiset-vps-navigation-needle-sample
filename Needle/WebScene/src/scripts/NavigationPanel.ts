/**
 * Destination picker, in-navigation HUD and toasts for MultiSet VPS navigation.
 *
 * THIS FILE IS YOURS. It is a template, not package code — copy it into your scripts folder
 * and change anything. The SDK deliberately ships no UI: a destination panel is a design
 * decision, not a navigation primitive.
 *
 * It is a pure CONSUMER of Navigation's public events — it reads no internal state and calls
 * only the documented API. So there is nothing here you could not have written yourself, and
 * nothing you lose by replacing it.
 *
 * Plain DOM with no framework and no Needle dependency, so it works unchanged in a three.js
 * app as well as under Needle Engine.
 *
 * ── Why DOM and not a Unity Canvas ───────────────────────────────────────────
 * The SDK owns the WebXR session, so Needle's UI raycaster never activates, and in
 * immersive-ar the WebGL canvas receives no pointer events. The session requests
 * `dom-overlay`, which does receive taps. A world-space Canvas still renders fine for
 * signage — it just cannot be tapped during a session.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Navigation, IMapPOI, NavigationState } from '@multisetai/vps/navigation';

export interface INavigationPanelOptions {
  /**
   * Where to mount. Default `document.body`.
   *
   * During an AR session pass the session's dom-overlay root — `adapter.getSession()
   * .getOverlayRoot()` — which is the same target the START AR button uses. Mounting
   * elsewhere still renders, but taps will not reach it while the session is presenting.
   */
  container?: HTMLElement;
  /** Label on the button that opens the picker. Default 'DESTINATIONS'. */
  openLabel?: string;
  /** Picker heading. Default 'Where to?'. */
  title?: string;
  /** Show a search field. Default true; set false for a handful of POIs. */
  search?: boolean;
  /** Milliseconds a toast stays up. Default 2600. */
  toastDuration?: number;
}

/** Seconds between distance refreshes while the picker is open. */
const DISTANCE_REFRESH_INTERVAL = 0.5;

/**
 * The default DOM overlay: destination picker with search, in-navigation HUD with progress
 * and remaining distance, and toasts.
 *
 * It is a pure CONSUMER of `Navigation`'s public events — it reads no internal state and calls
 * only the documented API. That is the contract that makes it replaceable: anything this can
 * do, a custom UI can do, so opting out costs styling and nothing else.
 *
 * DOM rather than a Unity Canvas by necessity: `NeedleAdapter` owns the WebXR session, so
 * Needle's UI raycaster never activates, and in `immersive-ar` the WebGL canvas receives no
 * pointer events. The session already requests `dom-overlay`, which does receive taps.
 *
 * ```ts
 * const ui = new NavigationUI(navigation, {
 *   container: adapter.getSession().getOverlayRoot() ?? undefined,
 * });
 * ```
 */
export class NavigationPanel {
  private readonly _navigation: Navigation;
  private readonly _opts: Required<Omit<INavigationPanelOptions, 'container'>>;
  private readonly _container: HTMLElement;

  private readonly _root: HTMLDivElement;
  private readonly _openButton: HTMLButtonElement;
  private readonly _panel: HTMLDivElement;
  private readonly _searchInput: HTMLInputElement | null;
  private readonly _list: HTMLUListElement;
  private readonly _hud: HTMLDivElement;
  private readonly _progressFill: HTMLDivElement;
  private readonly _destName: HTMLSpanElement;
  private readonly _remaining: HTMLSpanElement;
  private readonly _toast: HTMLDivElement;

  private _unsubscribers: Array<() => void> = [];
  private _toastTimer: ReturnType<typeof setTimeout> | null = null;
  private _sinceDistanceRefresh = 0;
  private _query = '';

  /**
   * Distance when the current navigation began, for the progress bar.
   *
   * Tracked here rather than in Navigation because it is presentation state: it resets when
   * the user walks AWAY from the destination, so the bar never runs backwards. Same rule as
   * the Unity implementation, minus its missing zero guard.
   */
  private _startDistance = 0;

  constructor(navigation: Navigation, options: INavigationPanelOptions = {}) {
    this._navigation = navigation;
    this._opts = {
      openLabel: options.openLabel ?? 'DESTINATIONS',
      title: options.title ?? 'Where to?',
      search: options.search !== false,
      toastDuration: options.toastDuration ?? 2600,
    };
    this._container = options.container ?? document.body;

    injectNavigationStyles(this._container.ownerDocument ?? document);

    const doc = this._container.ownerDocument ?? document;
    const el = <K extends keyof HTMLElementTagNameMap>(
      tag: K, className?: string
    ): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      return node;
    };

    this._root = el('div', CSS_PREFIX);

    this._toast = el('div', `${CSS_PREFIX}-toast ${CSS_PREFIX}-surface`);
    this._toast.setAttribute('role', 'status');
    this._root.appendChild(this._toast);

    // ── picker ──────────────────────────────────────────────────────────────
    this._openButton = el('button', `${CSS_PREFIX}-open ${CSS_PREFIX}-surface`);
    this._openButton.textContent = this._opts.openLabel;
    this._openButton.addEventListener('click', () => this.showDestinations());
    this._root.appendChild(this._openButton);

    this._panel = el('div', `${CSS_PREFIX}-panel ${CSS_PREFIX}-surface`);
    this._panel.hidden = true;
    const head = el('div', `${CSS_PREFIX}-panel-head`);
    const title = el('div', `${CSS_PREFIX}-title`);
    title.textContent = this._opts.title;
    const close = el('button', `${CSS_PREFIX}-close`);
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.hideDestinations());
    head.appendChild(title);
    head.appendChild(close);
    this._panel.appendChild(head);

    if (this._opts.search) {
      this._searchInput = el('input', `${CSS_PREFIX}-search`);
      this._searchInput.type = 'search';
      this._searchInput.placeholder = 'Search';
      this._searchInput.addEventListener('input', () => {
        this._query = this._searchInput!.value.trim().toLowerCase();
        this._renderList();
      });
      this._panel.appendChild(this._searchInput);
    } else {
      this._searchInput = null;
    }

    this._list = el('ul', `${CSS_PREFIX}-list`);
    this._panel.appendChild(this._list);
    this._root.appendChild(this._panel);

    // ── HUD ─────────────────────────────────────────────────────────────────
    this._hud = el('div', `${CSS_PREFIX}-hud ${CSS_PREFIX}-surface`);
    this._hud.hidden = true;
    const progress = el('div', `${CSS_PREFIX}-progress`);
    this._progressFill = el('div', `${CSS_PREFIX}-progress-fill`);
    progress.appendChild(this._progressFill);
    const row = el('div', `${CSS_PREFIX}-hud-row`);
    this._destName = el('span', `${CSS_PREFIX}-dest`);
    this._remaining = el('span', `${CSS_PREFIX}-remaining`);
    const stop = el('button', `${CSS_PREFIX}-stop`);
    stop.textContent = 'STOP';
    stop.addEventListener('click', () => this._navigation.stop());
    row.appendChild(this._destName);
    row.appendChild(this._remaining);
    row.appendChild(stop);
    this._hud.appendChild(progress);
    this._hud.appendChild(row);
    this._root.appendChild(this._hud);

    this._container.appendChild(this._root);

    this._subscribe();
    this._applyState(navigation.state);
  }

  get element(): HTMLElement {
    return this._root;
  }

  showDestinations(): void {
    if (this._navigation.state === 'unlocalized') return;
    this._panel.hidden = false;
    this._openButton.hidden = true;
    this._sinceDistanceRefresh = DISTANCE_REFRESH_INTERVAL;   // refresh on the next tick
    this._renderList();
  }

  hideDestinations(): void {
    this._panel.hidden = true;
    this._openButton.hidden = this._navigation.state === 'navigating'
      || this._navigation.state === 'off-navmesh';
    this._query = '';
    if (this._searchInput) this._searchInput.value = '';
  }

  showToast(message: string, durationMs = this._opts.toastDuration): void {
    this._toast.textContent = message;
    this._toast.dataset.visible = 'true';
    if (this._toastTimer !== null) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast.dataset.visible = 'false';
      this._toastTimer = null;
    }, durationMs);
  }

  dispose(): void {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._unsubscribers = [];
    if (this._toastTimer !== null) clearTimeout(this._toastTimer);
    this._root.remove();
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────

  private _subscribe(): void {
    const nav = this._navigation;
    this._unsubscribers.push(
      nav.on('stateChanged', ({ state }) => this._applyState(state)),

      nav.on('destinationChanged', poi => {
        this._destName.textContent = poi?.name ?? '';
        // Reset the baseline only for a NEW destination. Navigation clears the destination
        // immediately after `arrived`, so resetting on null would wipe the 100% the arrival
        // handler just set — the bar would snap back to empty at the moment of success.
        if (!poi) return;
        this._startDistance = 0;
        this._progressFill.style.width = '0%';
      }),

      nav.on('pathUpdated', ({ remainingDistance }) => {
        this._updateProgress(remainingDistance);
      }),

      nav.on('arrived', poi => {
        this.showToast(`You have arrived at ${poi.name}`);
        this._progressFill.style.width = '100%';
      }),

      nav.on('unreachable', poi => {
        this.showToast(`No route to ${poi.name}`);
      }),

      nav.on('tick', ({ deltaSeconds }) => {
        // Distances are refreshed only while the picker is open, at 2Hz. Recomputing a route
        // per row per frame is what made the Unity destination list expensive.
        if (this._panel.hidden) return;
        this._sinceDistanceRefresh += deltaSeconds;
        if (this._sinceDistanceRefresh < DISTANCE_REFRESH_INTERVAL) return;
        this._sinceDistanceRefresh = 0;
        this._renderList();
      })
    );
  }

  private _applyState(state: NavigationState): void {
    const navigating = state === 'navigating' || state === 'off-navmesh';
    this._hud.hidden = !navigating;
    this._openButton.hidden = navigating || !this._panel.hidden;
    this._openButton.disabled = state === 'unlocalized';
    this._openButton.textContent = state === 'unlocalized'
      ? 'LOCALIZING…'
      : this._opts.openLabel;

    if (navigating) this._panel.hidden = true;

    if (state === 'off-navmesh') {
      this.showToast('Move back onto the mapped area to continue');
    }
    if (state === 'unlocalized') {
      this._panel.hidden = true;
      this._progressFill.style.width = '0%';
    }
  }

  private _updateProgress(remaining: number): void {
    this._remaining.textContent = remaining > 0 ? `${Math.round(remaining)} m` : '';

    // A path that is longer than when we started means the user walked away, so re-baseline
    // rather than showing a bar that goes backwards.
    if (remaining > this._startDistance) this._startDistance = remaining;
    if (this._startDistance <= 0) {
      this._progressFill.style.width = '0%';
      return;
    }
    const progress = (this._startDistance - remaining) / this._startDistance;
    this._progressFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  }

  private _renderList(): void {
    const doc = this._root.ownerDocument;
    const pois = this._navigation.pois.filter(poi =>
      !this._query || poi.name.toLowerCase().includes(this._query)
    );

    // Sorted by walking distance, unreachable last — the nearest thing is what a lost user
    // wants first, and alphabetical order buries it.
    const rows = pois
      .map(poi => ({ poi, distance: this._navigation.distanceTo(poi) }))
      .sort((a, b) => {
        if (a.distance < 0 && b.distance < 0) return a.poi.name.localeCompare(b.poi.name);
        if (a.distance < 0) return 1;
        if (b.distance < 0) return -1;
        return a.distance - b.distance;
      });

    this._list.textContent = '';

    if (rows.length === 0) {
      const empty = doc.createElement('li');
      empty.className = `${CSS_PREFIX}-empty`;
      empty.textContent = this._navigation.pois.length === 0
        ? 'No destinations in this map'
        : 'Nothing matches that search';
      this._list.appendChild(empty);
      return;
    }

    for (const { poi, distance } of rows) {
      this._list.appendChild(this._createRow(poi, distance, doc));
    }
  }

  private _createRow(poi: IMapPOI, distance: number, doc: Document): HTMLLIElement {
    const item = doc.createElement('li');
    const button = doc.createElement('button');
    button.className = `${CSS_PREFIX}-item`;

    const name = doc.createElement('span');
    name.className = `${CSS_PREFIX}-item-name`;
    name.textContent = poi.name;

    const meta = doc.createElement('span');
    meta.className = `${CSS_PREFIX}-item-distance`;
    if (distance >= 0) {
      meta.textContent = `${Math.round(distance)} m`;
    } else {
      // Distinguish "cannot be routed to" from "we do not know yet" — before localization
      // every distance is unknown, and calling those unreachable would be a lie.
      meta.textContent = this._navigation.state === 'unlocalized' ? '' : 'No route';
      button.disabled = this._navigation.state !== 'unlocalized';
    }

    button.appendChild(name);
    button.appendChild(meta);
    button.addEventListener('click', () => {
      this._navigation.setDestination(poi);
      this.hideDestinations();
    });
    item.appendChild(button);
    return item;
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────
/** Class prefix for every element the default UI creates. */
const CSS_PREFIX = 'msvps-nav';

const STYLE_ELEMENT_ID = 'msvps-nav-styles';

/**
 * Inject the default UI's stylesheet, once per document.
 *
 * Everything is scoped under `.msvps-nav*` and no global element selectors are used — this
 * mounts into the customer's page, and a bare `button { }` rule would restyle their app.
 *
 * The visual language matches the AR button in the MultisetVPS template (translucent black,
 * backdrop blur, hairline white border) so the two do not look like different products.
 */
function injectNavigationStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

const CSS = `
.${CSS_PREFIX} {
  position: fixed; inset: 0; z-index: 9998;
  /* The root must not swallow taps: only the controls inside it are interactive. */
  pointer-events: none;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #fff;
  -webkit-tap-highlight-color: transparent;
}
.${CSS_PREFIX} button,
.${CSS_PREFIX} input { font: inherit; color: inherit; pointer-events: auto; }

/* ── shared surface ─────────────────────────────────────────────────────── */
.${CSS_PREFIX}-surface {
  background: rgba(0,0,0,0.45);
  border: 1px solid rgba(255,255,255,0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 12px;
}

/* ── open / close destinations ──────────────────────────────────────────── */
.${CSS_PREFIX}-open {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  min-width: 200px; padding: 14px 28px;
  font-size: 15px; font-weight: 600; letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
.${CSS_PREFIX}-open:disabled { opacity: 0.45; cursor: default; }
.${CSS_PREFIX}-open[hidden] { display: none; }

/* ── destination picker ─────────────────────────────────────────────────── */
.${CSS_PREFIX}-panel {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  width: min(420px, calc(100vw - 32px));
  max-height: min(60vh, 460px);
  display: flex; flex-direction: column; overflow: hidden;
  animation: ${CSS_PREFIX}-rise 0.18s ease-out;
}
.${CSS_PREFIX}-panel[hidden] { display: none; }
.${CSS_PREFIX}-panel-head {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.18);
}
.${CSS_PREFIX}-title { flex: 1; font-size: 15px; font-weight: 600; letter-spacing: 0.04em; }
.${CSS_PREFIX}-close {
  width: 30px; height: 30px; border: 0; border-radius: 50%;
  background: rgba(255,255,255,0.14); cursor: pointer; font-size: 16px; line-height: 1;
}
.${CSS_PREFIX}-search {
  margin: 12px 16px 4px; padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.28); border-radius: 8px;
  background: rgba(255,255,255,0.08); font-size: 14px;
}
.${CSS_PREFIX}-search::placeholder { color: rgba(255,255,255,0.5); }

/* Scrolls inside itself; the page body must never scroll horizontally on mobile. */
.${CSS_PREFIX}-list {
  flex: 1; overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  pointer-events: auto;
  margin: 0; padding: 8px; list-style: none;
}
.${CSS_PREFIX}-item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 12px 14px; margin: 0 0 6px;
  border: 0; border-radius: 8px; background: rgba(255,255,255,0.07);
  text-align: left; cursor: pointer; transition: background 0.12s;
}
.${CSS_PREFIX}-item:disabled { opacity: 0.45; cursor: default; }
.${CSS_PREFIX}-item-name { flex: 1; font-size: 15px; }
.${CSS_PREFIX}-item-distance {
  font-size: 13px; font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.65); white-space: nowrap;
}
.${CSS_PREFIX}-empty { padding: 24px 16px; text-align: center; color: rgba(255,255,255,0.6); }

/* ── in-navigation HUD ──────────────────────────────────────────────────── */
.${CSS_PREFIX}-hud {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  width: min(420px, calc(100vw - 32px)); padding: 14px 16px;
  animation: ${CSS_PREFIX}-rise 0.18s ease-out;
}
.${CSS_PREFIX}-hud[hidden] { display: none; }
.${CSS_PREFIX}-progress {
  height: 6px; border-radius: 3px; overflow: hidden;
  background: rgba(255,255,255,0.18);
}
.${CSS_PREFIX}-progress-fill {
  height: 100%; width: 0%;
  background: #33ccff; border-radius: 3px;
  transition: width 0.3s ease-out;
}
.${CSS_PREFIX}-hud-row {
  display: flex; align-items: baseline; gap: 12px; margin-top: 12px;
}
.${CSS_PREFIX}-dest { flex: 1; font-size: 15px; font-weight: 600; }
.${CSS_PREFIX}-remaining {
  font-size: 13px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.75);
}
.${CSS_PREFIX}-stop {
  padding: 8px 16px; border: 1px solid rgba(255,255,255,0.5); border-radius: 8px;
  background: transparent; font-size: 13px; font-weight: 600; cursor: pointer;
}

/* ── toast ──────────────────────────────────────────────────────────────── */
.${CSS_PREFIX}-toast {
  position: absolute; left: 50%; top: 24px; transform: translateX(-50%);
  max-width: calc(100vw - 32px); padding: 12px 20px;
  font-size: 14px; text-align: center;
  opacity: 0; transition: opacity 0.3s;
}
.${CSS_PREFIX}-toast[data-visible="true"] { opacity: 1; }

/* ── spinner, used while localizing ─────────────────────────────────────── */
.${CSS_PREFIX}-spinner {
  display: inline-block; width: 14px; height: 14px; margin-right: 8px;
  vertical-align: -2px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%;
  animation: ${CSS_PREFIX}-spin 0.8s linear infinite;
}

@keyframes ${CSS_PREFIX}-spin { to { transform: rotate(360deg); } }
@keyframes ${CSS_PREFIX}-rise {
  from { opacity: 0; transform: translate(-50%, 10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .${CSS_PREFIX}-panel, .${CSS_PREFIX}-hud { animation: none; }
  .${CSS_PREFIX}-progress-fill { transition: none; }
  .${CSS_PREFIX}-spinner { animation-duration: 2s; }
}
`;
