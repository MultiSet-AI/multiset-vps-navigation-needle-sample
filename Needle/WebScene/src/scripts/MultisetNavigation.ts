import * as THREE from 'three';
import { Behaviour, serializable, EventList, GameObject, RGBAColor } from '@needle-tools/engine';
import { MapSpace } from './MapSpace.js';
import { MapPOI } from './MapPOI.js';
import { MultisetVPS } from './MultisetVPS.js';
import {
    Navigation,
    NavMeshPathfinder,
    type IMapPOI,
} from '@multisetai/vps/navigation';
// Visuals and UI are SAMPLE code, not package code — the SDK ships navigation essentials only.
// Edit these two files to change how anything looks.
import { PathView, LabelsView, NavMeshView } from './NavigationVisuals.js';
import { NavigationPanel } from './NavigationPanel.js';

/**
 * Zero-code AR wayfinding for Needle Engine (Unity + Blender).
 *
 * Drop this on a GameObject, point it at your baked navmesh, and add MapPOI components to the
 * places people should be able to walk to. It wires up pathfinding, the arrowed path ribbon,
 * POI labels and the destination-picker UI.
 *
 * ── Scene requirements ───────────────────────────────────────────────────────
 * 1. A MultisetVPS component somewhere in the scene (it owns credentials and the session).
 * 2. Exactly one MapSpace root, with your navmesh and MapPOIs nested under it.
 * 3. This component on a GameObject OUTSIDE the MapSpace subtree.
 *
 * Point 3 is not a style preference. MapSpace.hideUntilLocalized hides its subtree until the
 * first localization, Needle treats an invisible GameObject as inactive, and an inactive
 * component never runs start() or update() — so nested here, navigation would never begin.
 *
 * ── The navmesh ──────────────────────────────────────────────────────────────
 * Bake it in Unity with the AI Navigation package, then export the surface as ordinary mesh
 * geometry and assign that object to Nav Mesh below. Keep it nested under MapSpace.
 *
 * Watch for T-junctions at seams — a vertex touching another triangle's edge without being
 * shared with it silently splits the navmesh into disconnected regions, and every route across
 * the seam reports no route. Switch on Show Nav Mesh Debug to see them.
 *
 * ── Customization guide ──────────────────────────────────────────────────────
 * Feel free to edit this file — it is a template you own, not a package file.
 *   - Replace the UI            -> set Use Default UI false and subscribe to navigation.on(...)
 *   - Wire Unity Buttons        -> the public methods near the bottom
 *   - React in the Inspector    -> the On Navigation Started / Stopped / Arrived events
 *   - Reach anything else       -> the navigation getter
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MultisetNavigation extends Behaviour {

    // EDITING RULE: never put a double quote in the doc comment of a @serializable field.
    // Needle copies those comments verbatim into C# Tooltip attributes without escaping them,
    // so a quote closes the C# string early and the generated file fails to compile with
    // CS1003. Use 'single quotes' instead.

    // ── Navmesh ───────────────────────────────────────────────────────────────

    /** The baked navmesh surface. Must be nested under the MapSpace root. */
    @serializable(THREE.Object3D)
    navMesh?: THREE.Object3D;

    /** Show the walkable surface as a green overlay. Use it to find gaps and T-junctions. */
    @serializable()
    showNavMeshDebug: boolean = false;

    // ── Path appearance ───────────────────────────────────────────────────────

    /** Arrow texture tiled along the path. Leave empty for a plain glowing strip. */
    @serializable(THREE.Texture)
    arrowTexture?: THREE.Texture;

    // RGBAColor, not THREE.Color: it is Needle's own colour type and is what the exporter maps
    // to a Unity Color field in the Inspector.
    @serializable(RGBAColor)
    pathColor: RGBAColor = new RGBAColor(0.2, 0.8, 1, 1);

    /** Ribbon width in metres. */
    @serializable()
    pathWidth: number = 0.35;

    /** Metres above the floor. Raise it if the ribbon flickers against the floor. */
    @serializable()
    pathHeightAboveFloor: number = 0.1;

    /**
     * Radius used to round off corners, in metres. 0 gives sharp corners.
     * Sharp corners make arrows look bent, because the joint is a trapezoid rather than a
     * rectangle; rounding spreads that shear over a short arc.
     */
    @serializable()
    pathCornerRadius: number = 0.4;

    /** Metres between the start of one arrow and the next. Controls the gap, not the arrow size. */
    @serializable()
    arrowSpacing: number = 2;

    /**
     * Metres one arrow occupies along the path. 0 = match Path Width, which keeps a square
     * texture undistorted. Raise it for longer arrows without changing how often they repeat.
     */
    @serializable()
    arrowLength: number = 0;

    /** Metres per second the arrows travel. Negative reverses them. */
    @serializable()
    arrowScrollSpeed: number = 1;

    // ── POI labels and UI ─────────────────────────────────────────────────────

    /** Show a floating name label above each MapPOI. */
    @serializable()
    showPOILabels: boolean = true;

    /** Hide POI labels further away than this, in metres. 0 shows them all. */
    @serializable()
    poiLabelMaxDistance: number = 40;

    /** Mount the built-in destination picker and progress UI. */
    @serializable()
    useDefaultUI: boolean = true;

    // ── Tuning ────────────────────────────────────────────────────────────────
    // Defaults come from MultiSet's Unity navigation implementation, where they were tuned in
    // the field. Change them only with a reason.

    /** Milliseconds between path recalculations. */
    @serializable()
    recalcIntervalMs: number = 500;

    /** Metres of movement that force an immediate recalculation. */
    @serializable()
    repathMoveThreshold: number = 0.5;

    /** Seconds off the walkable surface before navigation gives up. */
    @serializable()
    invalidPathGraceSeconds: number = 10;

    /** Metres from a POI that count as arrival. MapPOI can override this per place. */
    @serializable()
    arrivalRadius: number = 1.5;

    /**
     * Metres to search for walkable ground near the viewer.
     * Also separates floors: too large and the user snaps to the floor below.
     */
    @serializable()
    navMeshSnapDistance: number = 4;

    // ── Unity events ──────────────────────────────────────────────────────────

    /** Invoked when navigation starts toward a destination. */
    @serializable(EventList)
    onNavigationStarted!: EventList;

    /** Invoked when navigation stops without arriving. */
    @serializable(EventList)
    onNavigationStopped!: EventList;

    /** Invoked on arrival at the destination. */
    @serializable(EventList)
    onArrived!: EventList;

    // ── Runtime state ─────────────────────────────────────────────────────────

    private _navigation: Navigation | null = null;
    private _pathVisualizer: PathView | null = null;
    private _poiVisualizer: LabelsView | null = null;
    private _navMeshDebug: NavMeshView | null = null;
    private _ui: NavigationPanel | null = null;
    private _mapSpace: MapSpace | null = null;
    private _unsubscribers: Array<() => void> = [];
    private _setupStarted = false;
    private _sinceLabelRefresh = 0;

    /**
     * The Navigation instance, available once setup completes. Null until the VPS client has
     * authorized. Use this from other components for anything the Inspector does not cover.
     */
    get navigation(): Navigation | null { return this._navigation; }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    update(): void {
        // Setup waits for MultisetVPS.adapter, which only exists after its async authorize()
        // resolves — so this cannot happen in start(). Polling here keeps MultisetVPS
        // untouched; the alternative is an extra event on a template you may have edited.
        if (this._setupStarted) {
            this._tickLabels();
            return;
        }
        const vps = GameObject.findObjectsOfType(MultisetVPS, this.context)[0];
        const adapter = vps?.adapter;
        if (!adapter) return;

        this._setupStarted = true;
        void this._setup(adapter);
    }

    onDestroy(): void {
        super.onDestroy();
        for (const unsubscribe of this._unsubscribers) unsubscribe();
        this._unsubscribers = [];
        this._ui?.dispose();
        this._navMeshDebug?.dispose();
        this._poiVisualizer?.dispose();
        this._pathVisualizer?.dispose();
        this._navigation?.dispose();
        this._ui = null;
        this._navMeshDebug = null;
        this._poiVisualizer = null;
        this._pathVisualizer = null;
        this._navigation = null;
        this._mapSpace = null;
    }

    // ── Public API — wire these to Unity Buttons ───────────────────────────────
    // Public parameterless methods appear in the generated C# stub, so they show up in a
    // Button's onClick dropdown. Getters are skipped by the compiler, so `navigation` above
    // costs nothing in Unity.

    /** Open the destination picker. */
    showDestinations(): void { this._ui?.showDestinations(); }

    /** Close the destination picker. */
    hideDestinations(): void { this._ui?.hideDestinations(); }

    /** Stop navigating and clear the path. */
    stopNavigation(): void { this._navigation?.stop(); }

    /** Start navigating to the closest reachable POI. */
    navigateToNearest(): void {
        const nearest = this._navigation?.nearestPOI();
        if (nearest) this._navigation?.setDestination(nearest);
    }

    /** Toggle the navmesh debug overlay. */
    toggleNavMeshDebug(): void {
        if (this._navMeshDebug) this._navMeshDebug.visible = !this._navMeshDebug.visible;
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    private async _setup(adapter: NonNullable<MultisetVPS['adapter']>): Promise<void> {
        const mapSpace = GameObject.findObjectsOfType(MapSpace, this.context)[0];
        if (!mapSpace) {
            console.error(
                '[MultisetNavigation] No MapSpace found. Navigation needs one MapSpace root to' +
                ' define the map coordinate frame; nest the navmesh and MapPOIs under it.'
            );
            return;
        }
        if (!this.navMesh) {
            console.error(
                '[MultisetNavigation] Nav Mesh is not assigned. Bake a navmesh in Unity, export' +
                ' its surface as mesh geometry, and assign that object in the Inspector.'
            );
            return;
        }
        this._mapSpace = mapSpace;
        const space = mapSpace.space;

        let pathfinder: NavMeshPathfinder;
        try {
            pathfinder = await NavMeshPathfinder.fromObject3D(this.navMesh, {
                space: space.object,
            });
        } catch (err) {
            console.error('[MultisetNavigation]', err);
            return;
        }

        // The navmesh is geometry for pathfinding, not something to look at. Hiding it here
        // means you can leave it visible in the Unity editor, where you need to see it.
        this.navMesh.visible = false;

        this._navigation = await Navigation.create({
            adapter,
            mapSpace: space,
            pathfinder,
            pois: this._collectPOIs(space),
            recalcIntervalMs: this.recalcIntervalMs,
            repathMoveThreshold: this.repathMoveThreshold,
            invalidPathGraceMs: this.invalidPathGraceSeconds * 1000,
            arrivalRadius: this.arrivalRadius,
            navMeshSnapDistance: this.navMeshSnapDistance,
        });

        this._createVisuals(space, pathfinder);
        if (this.useDefaultUI) this._createUI(adapter);
        this._wireEvents();
    }

    /**
     * Build the POI list from MapPOI components.
     *
     * Positions are converted WORLD -> MAP SPACE rather than read from gameObject.position, so
     * POIs may sit at any depth under MapSpace. Reading the local position directly would only
     * be correct for direct children, and would silently misplace a tidy
     * Map Space/Content/POIs/... hierarchy.
     */
    private _collectPOIs(space: MapSpace['space']): IMapPOI[] {
        const components = GameObject.findObjectsOfType(MapPOI, this.context);
        const world = new THREE.Vector3();
        const pois: IMapPOI[] = [];

        for (const poi of components) {
            poi.gameObject.updateWorldMatrix(true, false);
            poi.gameObject.getWorldPosition(world);
            pois.push({
                id: poi.resolvedId,
                name: poi.resolvedName,
                // The Inspector enum and the package enum share members and numbering but are
                // distinct TypeScript types, so the value is carried across numerically.
                type: poi.poiType as unknown as IMapPOI['type'],
                position: space.worldToMap(world, new THREE.Vector3()),
                arrivalRadius: poi.arrivalRadius > 0 ? poi.arrivalRadius : undefined,
                description: poi.description || undefined,
            });
        }

        if (pois.length === 0) {
            console.warn(
                '[MultisetNavigation] No MapPOI components found. Add MapPOI to the places' +
                ' people should be able to navigate to, anywhere under the MapSpace root.'
            );
        }
        return pois;
    }

    private _createVisuals(space: MapSpace['space'], pathfinder: NavMeshPathfinder): void {
        // Everything visual is parented to MapSpace: it is all authored in map coordinates, so
        // localization moves it along with the rest of the anchored content for free.
        this._pathVisualizer = new PathView({
            map: this.arrowTexture ?? null,
            color: this.pathColor,
            width: this.pathWidth,
            heightAboveFloor: this.pathHeightAboveFloor,
            cornerRadius: this.pathCornerRadius,
            arrowSpacing: this.arrowSpacing,
            // 0 means 'auto' in the Inspector, since a Unity float cannot be undefined.
            arrowLength: this.arrowLength > 0 ? this.arrowLength : undefined,
            scrollSpeed: this.arrowScrollSpeed,
        });
        space.object.add(this._pathVisualizer.object);

        if (this.showPOILabels) {
            this._poiVisualizer = new LabelsView({
                maxVisibleDistance: this.poiLabelMaxDistance,
            });
            this._poiVisualizer.setPOIs(this._navigation!.pois);
            space.object.add(this._poiVisualizer.object);
        }

        if (this.showNavMeshDebug) {
            this._navMeshDebug = new NavMeshView(pathfinder.geometry);
            space.object.add(this._navMeshDebug.object);
        }
    }

    private _createUI(adapter: NonNullable<MultisetVPS['adapter']>): void {
        const session = adapter.getSession();
        this._ui = new NavigationPanel(this._navigation!, {
            container: session.getOverlayRoot(),
        });

        // dom-overlay is only an OPTIONAL feature of the session request. Without it the UI
        // renders but receives no taps once the session is presenting, and nothing else in the
        // stack would tell you why.
        const off = adapter.addSessionStartListener(() => {
            off();
            const xrSession = session.getXRSession() as (XRSession & {
                domOverlayState?: { type?: string };
            }) | null;
            if (xrSession && !xrSession.domOverlayState) {
                console.warn(
                    '[MultisetNavigation] This session did not grant dom-overlay, so the' +
                    ' navigation UI will not receive taps while AR is presenting. Drive' +
                    ' navigation from code, or from a Unity Button outside the session.'
                );
            }
        });
        this._unsubscribers.push(off);
    }

    private _wireEvents(): void {
        const navigation = this._navigation!;
        const camera = this.context.mainCamera as THREE.Camera;

        this._unsubscribers.push(
            navigation.on('pathUpdated', ({ corners }) => {
                this._pathVisualizer?.setPath(corners);
            }),
            navigation.on('tick', ({ deltaSeconds }) => {
                this._pathVisualizer?.update(deltaSeconds);
                this._poiVisualizer?.update(camera);
            }),
            navigation.on('destinationChanged', poi => {
                if (poi) this.onNavigationStarted?.invoke();
                else this.onNavigationStopped?.invoke();
            }),
            navigation.on('arrived', () => {
                this._pathVisualizer?.clear();
                this.onArrived?.invoke();
            })
        );
    }

    /** Refresh the distances shown on POI labels, at 2Hz rather than every frame. */
    private _tickLabels(): void {
        const navigation = this._navigation;
        const markers = this._poiVisualizer;
        if (!navigation || !markers) return;

        this._sinceLabelRefresh += this.context.time.deltaTime;
        if (this._sinceLabelRefresh < 0.5) return;
        this._sinceLabelRefresh = 0;

        for (const poi of navigation.pois) {
            markers.setDistance(poi.id, navigation.distanceTo(poi));
        }
    }
}
