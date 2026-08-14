import { Behaviour, serializable, addNewComponent, GameObject } from "@needle-tools/engine";
import { MapAnchor } from "./MapAnchor.js";
import { MapSpace } from "./MapSpace.js";
import { MapType } from "./MapType.js";
import { MultisetClient, type IMultisetClientConfig } from "@multisetai/vps/core";
import { NeedleAdapter } from "@multisetai/vps/needle";

/**
 * Multiset VPS component for Needle Engine (Unity + Blender).
 *
 * Drop this on any GameObject and fill in the Inspector fields — no code required.
 * The component handles the full lifecycle:
 *   1. awake()  — validates that credentials are set
 *   2. start()  — creates the MultisetClient and NeedleAdapter, wires MapAnchors,
 *                 runs authorization, then mounts the AR button UI
 *
 * IMPORTANT: Delete the Needle WebXR component from your scene before using this.
 * NeedleAdapter (added in start()) owns the WebXR session. Two session managers
 * conflict and the camera feed will not show.
 *
 * ── Customization guide ──────────────────────────────────────────────────────
 * Feel free to edit this file — it is a template you own, not a package file.
 * Common things to change:
 *   • UI layout / button styles  → _createUI()
 *   • What happens on localization success → onLocalizationSuccess callback in start()
 *   • What happens on session start / end  → _onSessionStart() / _onSessionEnd()
 *   • Adding your own overlays or HUD      → _createUI()
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MultisetVPS extends Behaviour {

    // ── Credentials ──────────────────────────────────────────────────────────

    @serializable()
    clientId: string = "";

    @serializable()
    clientSecret: string = "";

    // ── Map / object config ───────────────────────────────────────────────────
    //
    // EDITING RULE: never put a double quote in the doc comment of a @serializable
    // field. Needle copies those comments verbatim into C# Tooltip attributes
    // without escaping them, so a quote closes the C# string early and the
    // generated file fails to compile with CS1003. Use 'single quotes' instead.

    /**
     * For SingleMap / MapSet: the map or map-set code.
     * For ObjectTracking: comma-separated object codes (e.g. 'obj1,obj2').
     */
    @serializable()
    mapCode: string = "";

    @serializable()
    mapType: MapType = MapType.SingleMap;

    // ── Visualisation ─────────────────────────────────────────────────────────

    /** Overlay the scanned map mesh after localization (VPS modes only). */
    @serializable()
    showMesh: boolean = true;

    /** Show a coordinate-axis gizmo at the map origin after localization (VPS modes only). */
    @serializable()
    showGizmo: boolean = true;

    /** Load and render a 3D outline mesh for each detected object (OT mode only). */
    @serializable()
    showObjectMeshes: boolean = false;

    // ── VPS session options ───────────────────────────────────────────────────

    /** Run one localization automatically when the AR session starts (VPS modes). */
    @serializable()
    autoLocalize: boolean = true;

    /** Re-localize whenever XR tracking is lost and then recovered. */
    @serializable()
    relocalization: boolean = false;

    /** Continuously send localization requests in the background while the session is active. */
    @serializable()
    backgroundLocalization: boolean = false;

    /** Seconds between background localization attempts (10–180). 0 = SDK default (30 s). */
    @serializable()
    bgLocalizationInterval: number = 0;

    /** Reject results below confidenceThreshold when enabled. */
    @serializable()
    confidenceCheck: boolean = false;

    /** Minimum confidence to accept (0.2–0.8). Only used when confidenceCheck is true. */
    @serializable()
    confidenceThreshold: number = 0.5;

    /** Max ms to wait for a valid viewer pose before failing. 0 = SDK default (10 000 ms). */
    @serializable()
    poseTimeoutMs: number = 0;

    // ── VPS client options ────────────────────────────────────────────────────

    /** Request geographic coordinates in the localization response. */
    @serializable()
    convertToGeoCoordinates: boolean = false;

    /** Send a Geolocation API hint with each request to narrow the search area. */
    @serializable()
    passGeoPose: boolean = false;

    /** Ignore altitude when filtering by geo position. Only valid when passGeoPose is enabled. */
    @serializable()
    use2DFiltering: boolean = false;

    /** Local-space position hint 'x,y,z' to narrow the search area (optional). */
    @serializable()
    hintPosition: string = "";

    /** Search radius in metres around hintPosition. 0 = no hint. */
    @serializable()
    hintRadius: number = 0;

    /** Comma-separated map codes to restrict search (map-set mode only). */
    @serializable()
    hintMapCodes: string = "";

    // ── Object tracking options ───────────────────────────────────────────────

    /** Run object detection automatically when the AR session starts (OT mode). */
    @serializable()
    autoTracking: boolean = false;

    /** Re-attempt tracking when XR tracking is lost and recovered (OT mode). */
    @serializable()
    restartTracking: boolean = false;

    /** Ms to wait before capturing a frame for tracking (camera stabilisation). */
    @serializable()
    trackingCaptureDelayMs: number = 0;

    // ── Runtime state ─────────────────────────────────────────────────────────

    private _client: MultisetClient | null = null;
    private _adapter: NeedleAdapter | null = null;

    private _uiContainer: HTMLDivElement | null = null;
    private _arButton: HTMLButtonElement | null = null;
    private _captureButton: HTMLButtonElement | null = null;
    private _trackButton: HTMLButtonElement | null = null;
    private _clearMeshesButton: HTMLButtonElement | null = null;

    /**
     * The underlying NeedleAdapter, available after start() resolves.
     * Use this from other components to call registerAnchor(), add listeners, etc.
     * Null until authorization succeeds.
     */
    get adapter(): NeedleAdapter | null { return this._adapter; }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    awake() {
        // Early warning — Inspector fields are read-only here; just validate.
        if (!this.clientId || !this.clientSecret || !this.mapCode) {
            console.warn("[MultisetVPS] clientId, clientSecret, and mapCode must be set in the Inspector.");
        }
    }

    async start() {
        if (!this.clientId || !this.clientSecret || !this.mapCode) return;

        const isOT = this.mapType === MapType.ObjectTracking;
        const isMapSet = this.mapType === MapType.MapSet;
        const mapTypeStr = ({
            [MapType.SingleMap]: "map",
            [MapType.MapSet]: "map-set",
            [MapType.ObjectTracking]: "object-tracking",
        } as const)[this.mapType];

        const hintPosition = this.hintPosition.trim() || undefined;
        const hintRadius = this.hintRadius > 0 ? this.hintRadius : undefined;
        const hintMapCodes = isMapSet && this.hintMapCodes.trim()
            ? this.hintMapCodes.trim().split(",").map(s => s.trim()).filter(Boolean)
            : undefined;

        // ── 1. Create the HTTP client ─────────────────────────────────────────
        // isRightHanded: true tells the API to return poses in a right-handed
        // (Three.js / WebXR) coordinate system. Do not change this.
        this._client = new MultisetClient({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            isRightHanded: true,
            ...(isOT
                ? {
                    mapType: "object-tracking",
                    code: this.mapCode.split(",").map(s => s.trim()).filter(Boolean),
                }
                : {
                    mapType: mapTypeStr as "map" | "map-set",
                    code: this.mapCode,
                    convertToGeoCoordinates: this.convertToGeoCoordinates,
                    passGeoPose: this.passGeoPose || undefined,
                    ...(this.passGeoPose ? { use2DFiltering: this.use2DFiltering } : {}),
                    hintPosition,
                    hintRadius,
                    ...(hintMapCodes ? { hintMapCodes } : {}),
                }),
        } as IMultisetClientConfig);

        // ── 2. Create and attach the NeedleAdapter ────────────────────────────
        // addNewComponent() registers the adapter as a Needle Behaviour so
        // Needle calls awake() on it synchronously before returning. awake()
        // creates the XRSessionManager and disables Needle's built-in WebXR
        // component. The MapAnchor wiring below and the startSession() call
        // inside the button handler both depend on awake() having run — if
        // Needle ever makes this async those calls will fail.
        // useDefaultButton: false because we build our own richer UI below.
        this._adapter = new NeedleAdapter({
            client: this._client,
            showMesh: !isOT && this.showMesh,
            showGizmo: !isOT && this.showGizmo,
            showObjectMeshes: isOT && this.showObjectMeshes,
            useDefaultButton: false,
            sessionOptions: {
                autoLocalize: !isOT && this.autoLocalize,
                relocalization: !isOT && this.relocalization,
                backgroundLocalization: this.backgroundLocalization,
                bgLocalizationInterval: this.bgLocalizationInterval > 0 ? this.bgLocalizationInterval : undefined,
                confidenceCheck: this.confidenceCheck,
                confidenceThreshold: this.confidenceThreshold,
                poseTimeoutMs: this.poseTimeoutMs > 0 ? this.poseTimeoutMs : undefined,
                autoTracking: isOT && this.autoTracking,
                restartTracking: isOT && this.restartTracking,
                trackingCaptureDelayMs: isOT && this.trackingCaptureDelayMs > 0 ? this.trackingCaptureDelayMs : undefined,

                // Called when the AR session starts (camera is active, XR frame loop running).
                // Use this to show in-session UI, start timers, etc.
                onSessionStart: () => { this._onSessionStart(); },

                // Called when the AR session ends (user pressed STOP AR or session was interrupted).
                // Use this to hide in-session UI, save state, etc.
                onSessionEnd: () => { this._onSessionEnd(); },

                // Called at the start of a localization attempt — good place to show a spinner.
                onLocalizationInit: () => {
                    if (this._captureButton) {
                        this._captureButton.disabled = true;
                        this._captureButton.textContent = "LOCALIZING...";
                    }
                },

                // Called when localization fails or falls below the confidence threshold.
                // reason is a human-readable string describing why it failed.
                onLocalizationFailure: (reason) => {
                    console.warn("[MultisetVPS] Localization failed:", reason);
                    this._resetCaptureButton();
                },

                // Called at the start of an object tracking attempt.
                onObjectTrackingInit: () => {
                    if (this._trackButton) {
                        this._trackButton.disabled = true;
                        this._trackButton.textContent = "TRACKING...";
                    }
                },

                // Called when object tracking succeeds.
                // result.objectCodes contains the detected object IDs.
                onObjectTrackingSuccess: (result) => {
                    console.log("[MultisetVPS] Object tracking success — codes:", result.objectCodes, "confidence:", result.confidence.toFixed(3));
                    this._resetTrackButton();
                },

                // Called when object tracking fails or falls below the confidence threshold.
                onObjectTrackingFailure: (reason) => {
                    console.warn("[MultisetVPS] Object tracking failed:", reason);
                    this._resetTrackButton();
                },

                // The WebGL context can be lost when the app is backgrounded on mobile.
                // The session is ended automatically — prompt the user to restart.
                onContextLost: () => console.warn("[MultisetVPS] WebGL context lost — AR session ended."),
                onContextRestored: () => {},

                onError: (err) => console.error("[MultisetVPS] Error:", err),
            },

            // Called after a successful localization with the worldFromMap matrix.
            // worldFromMap transforms a point in VPS map space into Three.js world space.
            // Use this to place scene objects at known physical locations in the scanned map.
            // MapAnchor handles this automatically for Inspector-placed objects — add your
            // own logic here only if you need to do something beyond placing a GameObject.
            onLocalizationSuccess: (result) => {
                console.log(
                    "[MultisetVPS] Localization success — confidence:",
                    result.localizeData.confidence?.toFixed(3),
                    "mapCode:", result.localizeData.mapCodes?.[0] ?? "n/a"
                );
                this._resetCaptureButton();
            },

            onObjectMeshLoaded: (_code) => {},
        });

        addNewComponent(this.gameObject, this._adapter);

        // ── 3. Wire MapSpace roots and MapAnchors ─────────────────────────────
        // Find every map-anchored object in the scene and connect it to the
        // adapter so it receives localization events. This covers content placed
        // at edit time; for objects spawned at runtime call
        // adapter.registerAnchor() from your own code instead.
        //
        // MapSpace roots are wired first so an entire anchored subtree is placed
        // before any individual MapAnchor inside it can react. Both implement the
        // same connectAdapter/applyLocalization pair, so the adapter treats them
        // identically — a scene may use either, both, or neither.
        const mapSpaces = GameObject.findObjectsOfType(MapSpace, this.context);
        for (const space of mapSpaces) {
            space.connectAdapter(this._adapter);
        }
        if (mapSpaces.length > 1) {
            console.warn(
                `[MultisetVPS] Found ${mapSpaces.length} MapSpace roots. Every one of them will be` +
                " moved to the same map origin, which is rarely intended — use a single MapSpace" +
                " root and nest your content under it."
            );
        }

        const mapAnchors = GameObject.findObjectsOfType(MapAnchor, this.context);
        for (const anchor of mapAnchors) {
            // MapAnchor writes a WORLD position into gameObject.position, which is a
            // LOCAL transform — correct only at scene root. Nested inside a MapSpace
            // (itself moved to the map origin) the offset is applied twice and the
            // object lands somewhere meaningless. Catch it here rather than let the
            // developer debug a mysterious placement bug.
            for (let p = anchor.gameObject.parent; p; p = p.parent) {
                if (mapSpaces.some(s => s.gameObject === p)) {
                    console.warn(
                        `[MultisetVPS] MapAnchor on "${anchor.gameObject.name}" is nested under the` +
                        ` MapSpace "${p.name}". Its offset will be applied twice and the object will be` +
                        " misplaced. Either move it to the scene root, or delete the MapAnchor and let" +
                        " its normal Unity Transform position it inside the MapSpace."
                    );
                    break;
                }
            }
            anchor.connectAdapter(this._adapter);
        }

        // ── 4. Authorize and build UI ─────────────────────────────────────────
        // Authorization is async and can fail (wrong credentials, no network).
        // The adapter and anchors are wired before this so they're ready the
        // moment a session starts, but the AR button only appears after success
        // so the user can't trigger a session before auth completes.
        try {
            await this._client.authorize();
            console.log("[MultisetVPS] Authorized");
            this._createUI();
        } catch (err) {
            console.error("[MultisetVPS] Authorization failed:", err);
        }
    }

    onDestroy() {
        super.onDestroy();
        // _adapter is a Needle Behaviour on this.gameObject — Needle will call
        // its own onDestroy() via the component lifecycle, so no manual dispose needed.
        this._removeUI();
        this._adapter = null;
        this._client = null;
    }

    // ── UI ────────────────────────────────────────────────────────────────────
    // Edit _createUI() freely to match your app's design.
    // The only hard requirement: startSession() must be the FIRST call inside
    // the click handler — any await before it consumes the browser's user
    // activation token and the session request will be rejected.

    private _createUI(): void {
        const isOT = this.mapType === MapType.ObjectTracking;

        // Mount the UI on the canvas parent so it sits in the same stacking context.
        const canvas = document.querySelector('canvas');
        const mountTarget = canvas?.parentElement ?? document.body;

        const container = document.createElement('div');
        container.style.cssText = [
            'position:fixed', 'top:50%', 'left:50%',
            'transform:translate(-50%,-50%)',
            'display:flex', 'flex-direction:column', 'align-items:center',
            'gap:12px', 'z-index:9999', 'pointer-events:none',
        ].join(';');

        // Shared base style for all buttons.
        const base = [
            'pointer-events:auto',
            'min-width:180px',
            'padding:14px 32px',
            'border:2px solid rgba(255,255,255,0.85)',
            'border-radius:8px',
            'background:rgba(0,0,0,0.45)',
            'color:#fff',
            'font-size:15px',
            'font-weight:600',
            'letter-spacing:0.06em',
            'cursor:pointer',
            'backdrop-filter:blur(6px)',
            '-webkit-backdrop-filter:blur(6px)',
            'transition:background 0.15s,border-color 0.15s',
        ].join(';');

        // START AR / STOP AR — toggles the XR session.
        const arBtn = document.createElement('button');
        arBtn.textContent = 'START AR';
        arBtn.style.cssText = base;
        arBtn.addEventListener('click', () => {
            if (this._adapter?.isActive()) {
                this._adapter.stopSession();
            } else {
                // startSession() must be the first call — no await before this.
                void this._adapter?.startSession();
            }
        });

        // CAPTURE FRAME — triggers a manual localization (VPS modes only).
        // Hidden until the session starts; shown by _onSessionStart().
        const captureBtn = document.createElement('button');
        captureBtn.textContent = 'CAPTURE FRAME';
        captureBtn.style.cssText = base + ';display:none';
        captureBtn.addEventListener('click', async () => {
            if (!this._adapter || this._adapter.isLocalizing) return;
            captureBtn.disabled = true;
            captureBtn.textContent = 'LOCALIZING...';
            try {
                await this._adapter.localizeFrame();
            } catch {
                this._resetCaptureButton();
            }
        });

        // TRACK OBJECT — triggers a manual object tracking request (OT mode only).
        const trackBtn = document.createElement('button');
        trackBtn.textContent = 'TRACK OBJECT';
        trackBtn.style.cssText = base + ';display:none';
        trackBtn.addEventListener('click', async () => {
            if (!this._adapter || this._adapter.isLocalizing) return;
            trackBtn.disabled = true;
            trackBtn.textContent = 'TRACKING...';
            try {
                await this._adapter.trackObjects();
            } catch {
                this._resetTrackButton();
            }
        });

        // CLEAR MESHES — removes all object outline meshes from the scene (OT mode only).
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'CLEAR MESHES';
        clearBtn.style.cssText = base + ';display:none';
        clearBtn.addEventListener('click', () => {
            this._adapter?.clearObjectMeshes();
        });

        if (!isOT) container.appendChild(captureBtn);
        if (isOT) container.appendChild(trackBtn);
        if (isOT) container.appendChild(clearBtn);
        container.appendChild(arBtn);
        mountTarget.appendChild(container);

        this._uiContainer = container;
        this._arButton = arBtn;
        this._captureButton = captureBtn;
        this._trackButton = trackBtn;
        this._clearMeshesButton = clearBtn;
    }

    private _removeUI(): void {
        this._uiContainer?.remove();
        this._uiContainer = null;
        this._arButton = null;
        this._captureButton = null;
        this._trackButton = null;
        this._clearMeshesButton = null;
    }

    // Called by the onSessionStart callback — update button labels and show in-session controls.
    private _onSessionStart(): void {
        const isOT = this.mapType === MapType.ObjectTracking;
        if (this._arButton) this._arButton.textContent = 'STOP AR';
        if (!isOT && this._captureButton) this._captureButton.style.display = '';
        if (isOT && this._trackButton) this._trackButton.style.display = '';
        if (isOT && this._clearMeshesButton) this._clearMeshesButton.style.display = '';
    }

    // Called by the onSessionEnd callback — reset button labels and hide in-session controls.
    private _onSessionEnd(): void {
        if (this._arButton) this._arButton.textContent = 'START AR';
        if (this._captureButton) { this._captureButton.style.display = 'none'; this._resetCaptureButton(); }
        if (this._trackButton) { this._trackButton.style.display = 'none'; this._resetTrackButton(); }
        if (this._clearMeshesButton) this._clearMeshesButton.style.display = 'none';
    }

    private _resetCaptureButton(): void {
        if (this._captureButton) {
            this._captureButton.disabled = false;
            this._captureButton.textContent = 'CAPTURE FRAME';
        }
    }

    private _resetTrackButton(): void {
        if (this._trackButton) {
            this._trackButton.disabled = false;
            this._trackButton.textContent = 'TRACK OBJECT';
        }
    }
}
