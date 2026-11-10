import { Behaviour, serializable, GameObject, getParam } from '@needle-tools/engine';
import { MultisetVPS } from './MultisetVPS.js';
import { MapType } from './MapType.js';
import { VPSSettingsPanel, type VPSSettingChange } from './VPSSettingsPanel.js';

/**
 * Runtime settings panel for MultiSet VPS, for testing and tuning on a device.
 *
 * Add this to any GameObject in the scene. It finds the MultisetVPS component, waits for it to
 * authorize, and shows a gear button over the AR view. The panel changes localization options
 * during a session, so you can compare them without rebuilding from Unity.
 *
 * ── How values flow ──────────────────────────────────────────────────────────
 * The MultisetVPS Inspector values are the starting state. Panel changes call the SDK setters
 * and last for this page load only: they are never written back to the Inspector or the scene.
 * Settings the SDK reads only at startup are listed read-only in the panel.
 *
 * ── Showing it ───────────────────────────────────────────────────────────────
 * Off by default so a shipped build stays clean. Turn on Show Panel, or add ?vpssettings to the
 * page URL to show it in any build without re-exporting from Unity.
 *
 * Feel free to edit this file. It is sample code, not package code.
 */
export class VPSSettings extends Behaviour {

    // EDITING RULE: never put a double quote in the doc comment of a @serializable field.
    // Needle copies those comments into C# Tooltip attributes without escaping them, and the
    // generated file then fails to compile with CS1003. Use 'single quotes' instead.

    /** Show the panel. Adding ?vpssettings to the page URL shows it even when this is off. */
    @serializable()
    showPanel: boolean = false;

    /** Start as a small gear button instead of the open panel. */
    @serializable()
    startCollapsed: boolean = true;

    /** Pin the panel to the top-left corner instead of the top-right. */
    @serializable()
    alignLeft: boolean = false;

    // ── Runtime state ─────────────────────────────────────────────────────────

    private _panel: VPSSettingsPanel | null = null;
    private _unsubscribers: Array<() => void> = [];
    private _setupStarted = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    update(): void {
        if (this._setupStarted) return;
        if (!this.showPanel && !urlFlagSet('vpssettings')) {
            this._setupStarted = true;
            return;
        }
        // Same wait as MultisetNavigation: the adapter exists only after authorize() resolves.
        const vps = GameObject.findObjectsOfType(MultisetVPS, this.context)[0];
        if (!vps?.adapter || !vps.client) return;

        this._setupStarted = true;
        if (vps.mapType === MapType.ObjectTracking) {
            console.warn('[VPSSettings] The settings panel covers map localization only; it is not shown in object-tracking mode.');
            return;
        }
        this._setup(vps);
    }

    onDestroy(): void {
        super.onDestroy();
        for (const unsubscribe of this._unsubscribers) unsubscribe();
        this._unsubscribers = [];
        this._panel?.dispose();
        this._panel = null;
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    private _setup(vps: MultisetVPS): void {
        const adapter = vps.adapter!;
        const client = vps.client!;
        const session = adapter.getSession();

        const panel = new VPSSettingsPanel({
            container: session.getOverlayRoot(),
            alignLeft: this.alignLeft,
            startCollapsed: this.startCollapsed,
            initial: {
                occlusion: vps.occlusion,
                showMesh: vps.showMesh,
                deepSearch: vps.deepSearch,
                searchDepth: vps.searchDepth > 0 ? Math.round(vps.searchDepth) : 0,
                queryModeFallback: vps.queryModeFallback,
                useLastPoseAsHint: vps.useLastPoseAsHint,
                multiFrame: vps.multiFrame,
            },
            startupOnly: [
                { label: 'First localization until success', value: onOff(vps.firstLocalizationUntilSuccess) },
                { label: 'Use active map version', value: onOff(vps.useActiveMapVersion) },
                { label: 'Frames per multi-frame query', value: vps.multiFrameCount > 0 ? String(vps.multiFrameCount) : 'default (4)' },
            ],
            onChange: (change: VPSSettingChange) => {
                switch (change.key) {
                    case 'occlusion': adapter.setOcclusion(change.value); break;
                    case 'showMesh': adapter.setShowMesh(change.value); break;
                    case 'deepSearch': client.setQueryOptions({ queryMode: change.value ? 'vps-2' : undefined }); break;
                    case 'searchDepth': client.setQueryOptions({ depth: change.value > 0 ? change.value : undefined }); break;
                    case 'queryModeFallback': session.setQueryModeFallback(change.value); break;
                    case 'useLastPoseAsHint': session.setUseLastPoseAsHint(change.value); break;
                    case 'multiFrame': session.setLocalizationMode(change.value ? 'multi-frame' : 'single-frame'); break;
                }
                console.log(`[VPSSettings] ${change.key} = ${change.value}`);
            },
            onLocalize: async () => {
                const result = await adapter.localizeFrame();
                // Success is reported by the localization listener below.
                if (!result) panel.setStatus('No pose found. Aim at a well-lit area with detail, then try again.', 'error');
            },
            onClearHints: () => {
                client.setHints({ hintPosition: undefined, hintRadius: undefined, hintFloorHeight: undefined });
                console.log('[VPSSettings] hints cleared');
            },
        });
        this._panel = panel;
        panel.setSessionActive(adapter.isActive());

        this._unsubscribers.push(
            adapter.addSessionStartListener(() => panel.setSessionActive(true)),
            adapter.addSessionEndListener(() => panel.setSessionActive(false)),
            adapter.addLocalizationListener(result => {
                const data = result.localizeData;
                const parts = [`Localized with ${result.queryMode ?? 'vps-1'}`];
                if (data.confidence !== undefined) parts.push(`confidence ${data.confidence.toFixed(2)}`);
                if (data.imageId) parts.push(`best frame ${data.imageId} of ${data.frames?.length ?? '?'}`);
                panel.setStatus(parts.join(' · '), 'success');
            })
        );
    }
}

function onOff(value: boolean): string {
    return value ? 'on' : 'off';
}

/** True for ?name or ?name=1/true, false for ?name=0/false or when absent. */
function urlFlagSet(name: string): boolean {
    const value = getParam(name) as unknown;
    if (value === undefined || value === null || value === false) return false;
    const text = String(value).toLowerCase();
    return text !== '0' && text !== 'false';
}
