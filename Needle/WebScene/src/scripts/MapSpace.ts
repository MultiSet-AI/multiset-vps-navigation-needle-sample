import * as THREE from 'three';
import { Behaviour, serializable } from '@needle-tools/engine';
import { NeedleAdapter } from '@multisetai/vps/needle';
import { MapSpace as VpsMapSpace } from '@multisetai/vps/three';
import type { ILocalizeAndMapDetails } from '@multisetai/vps/core';

/**
 * Zero-code VPS map root for Needle Engine (Unity + Blender).
 *
 * Add this component to ONE empty GameObject at the root of your scene, then
 * nest all map-anchored content underneath it. On every successful localization
 * this GameObject is moved so that its origin coincides with the scanned map's
 * origin — every descendant follows automatically.
 *
 * ── Why this instead of MapAnchor? ───────────────────────────────────────────
 * With MapSpace, a child's LOCAL Unity Transform position IS its map coordinate.
 * Paste the value straight out of the developer portal's Map Viewer into the
 * child's normal Unity Transform — no per-object component, no Offset field,
 * and the layout you see in the Unity editor is the layout you get in AR.
 *
 * MapAnchor is still the right tool for:
 *   - POIs spawned at runtime from backend data (see toLocal() below)
 *   - objects that must NOT inherit the map's rotation
 *   - one-off anchored objects in a scene that has no MapSpace
 * The two compose freely; an unparented MapAnchor behaves exactly as before.
 *
 * ── WARNING: hideUntilLocalized deactivates the whole subtree ────────────────
 * Needle treats an invisible GameObject as inactive, and that applies to every
 * DESCENDANT of this root — none of their start() methods run until the first
 * localization. Keep always-running logic (session listeners, UI, network
 * polling) on a separate GameObject OUTSIDE this hierarchy. Same rule as
 * MapAnchor, but here the blast radius is the entire anchored subtree.
 *
 * ── Where the maths lives ────────────────────────────────────────────────────
 * This component is a thin Needle wrapper. The placement maths — and the
 * Unity→three.js handedness correction, with the empirical verification notes —
 * live in the package class it delegates to: MapSpace in @multisetai/vps/three.
 * Read that file if you need to understand or re-verify the coordinate handling.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MapSpace extends Behaviour {

    // NOTE: keep the comment below short. Needle turns a @serializable field's doc
    // comment into its Unity Inspector tooltip verbatim, so anything long becomes an
    // unreadable wall of text in the Inspector. Never use double quotes here either —
    // they break the generated C#.

    /** Hide anchored content until the first localization, and re-hide on session end. */
    @serializable()
    hideUntilLocalized: boolean = true;

    // ── Internal state ────────────────────────────────────────────────────────

    private _space: VpsMapSpace | null = null;

    /**
     * The underlying package MapSpace, for code that wants mapToWorld() /
     * worldToMap() / add(). Created on first use, so it is safe to read from
     * another component's start().
     *
     * The Inspector field below is copied in once, when this object is created.
     * To change hiding at runtime, set it here instead:
     *   mapSpace.space.hideUntilLocalized = false;
     */
    get space(): VpsMapSpace {
        if (!this._space) {
            this._space = new VpsMapSpace(this.gameObject, {
                hideUntilLocalized: this.hideUntilLocalized,
            });
        }
        return this._space;
    }

    // ── Needle lifecycle ──────────────────────────────────────────────────────

    awake(): void {
        // Constructing the space here applies hideUntilLocalized before the first
        // frame is drawn, so unlocalized content is never briefly visible.
        void this.space;
    }

    onDestroy(): void {
        super.onDestroy();
        // Without this the adapter retains references to this object's listeners,
        // preventing garbage collection and firing callbacks on a dead component.
        this._space?.dispose();
        this._space = null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Convert a portal map coordinate (Unity, left-handed) into the LOCAL
     * position to assign to a child of this MapSpace at runtime.
     *
     * Children authored in Unity get this conversion for free from the exporter.
     * Objects parented under MapSpace in code do NOT, so route their coordinates
     * through here:
     *
     *   const poi = instantiate(prefab);
     *   mapSpace.gameObject.add(poi);
     *   poi.position.copy(MapSpace.toLocal(new THREE.Vector3(1.5, 0, -2.0)));
     *
     * If you would rather not parent runtime content at all, use MapAnchor
     * with adapter.registerAnchor() — it accepts Unity values directly.
     */
    static toLocal(unityCoord: THREE.Vector3, target = new THREE.Vector3()): THREE.Vector3 {
        return VpsMapSpace.toLocal(unityCoord, target);
    }

    /**
     * Wire this root to a NeedleAdapter so it receives localization events.
     * Called automatically by MultisetVPS for scene-placed MapSpace roots.
     * For a MapSpace created at runtime use adapter.registerAnchor(mapSpace),
     * which also replays the last localization result.
     *
     * Safe to call more than once: previous listeners are removed first, so no
     * duplicate events accumulate.
     */
    connectAdapter(adapter: NeedleAdapter): void {
        this.space.connect(adapter);
    }

    /**
     * Apply a localization result directly, bypassing the event system.
     * Called by NeedleAdapter.registerAnchor() to replay the last result when a
     * root is registered mid-session. Also callable manually to force
     * re-placement (e.g. in tests).
     */
    applyLocalization(result: ILocalizeAndMapDetails, worldFromMap: THREE.Matrix4): void {
        this.space.applyLocalization(result, worldFromMap);
    }
}
