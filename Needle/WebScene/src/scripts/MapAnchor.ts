import * as THREE from 'three';
import { Behaviour, serializable } from '@needle-tools/engine';
import { NeedleAdapter } from '@multisetai/vps/needle';
import type { ILocalizeAndMapDetails } from '@multisetai/vps/core';

/**
 * Zero-code VPS anchor for Needle Engine (Unity + Blender).
 *
 * Add this component to any GameObject you want placed in AR at a specific
 * location relative to the scanned VPS map. Fill in the Inspector fields —
 * no code required. MultisetVPS discovers all MapAnchor instances at startup
 * and wires them automatically.
 *
 * For objects spawned at runtime (from API data, prefab instantiation, etc.),
 * call adapter.registerAnchor(anchor) after adding the component — this
 * registers the listeners and immediately applies the last localization result
 * if one already exists in the current session.
 *
 * ── Coordinate system ────────────────────────────────────────────────────────
 * By default (isRightHanded = false) all values are entered in Unity's
 * left-handed coordinate system — exactly as you'd type them in the Unity
 * Inspector. The conversion to Three.js (right-handed) is applied automatically:
 *   Position: negate X  →  Unity (1, 0, 2) becomes Three.js (-1, 0, 2)
 *   Rotation: negate Y and Z  →  Unity (0, 90, 0) becomes Three.js (0, -90, 0)
 * Set isRightHanded = true only if you are entering Three.js values directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MapAnchor extends Behaviour {

    /**
     * Position offset from the map origin in metres.
     * When isRightHanded is false (default): supply Unity Inspector values directly — X will be negated automatically.
     * When isRightHanded is true: supply Three.js values as-is (no conversion).
     */
    @serializable(THREE.Vector3)
    offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    /** Match the map's orientation. Disable to keep the object's original rotation. */
    @serializable()
    matchOrientation: boolean = true;

    /**
     * Extra rotation applied on top of the map orientation.
     * When isRightHanded is false (default): supply Unity Inspector values directly — Y and Z are negated automatically.
     * When isRightHanded is true: supply Three.js values as-is (no conversion).
     * Only applied when matchOrientation is true.
     */
    @serializable(THREE.Euler)
    rotationOffset: THREE.Euler = new THREE.Euler(0, 0, 0);

    /**
     * Set to true if offset and rotationOffset are already in Three.js (right-handed) space — no conversion is applied.
     * Leave false (default) to enter values in Unity (left-handed) space: X in position and Y/Z in rotation are negated automatically.
     */
    @serializable()
    isRightHanded: boolean = false;

    /** Hide until the first localization. Re-hides on session end. */
    @serializable()
    hideUntilLocalized: boolean = true;

    // ── Internal state ────────────────────────────────────────────────────────

    private _adapter: NeedleAdapter | null = null;

    // Stored as instance refs so they can be removed cleanly in connectAdapter
    // and onDestroy. Using arrow functions here would create new refs each call
    // making removeLocalizationListener unable to find them.
    private _onLocalize: ((result: ILocalizeAndMapDetails, worldFromMap: THREE.Matrix4) => void) | null = null;
    private _onSessionEnd: (() => void) | null = null;

    // ── Needle lifecycle ──────────────────────────────────────────────────────

    awake(): void {
        // Hide immediately so the object is invisible until VPS places it.
        // Note: an invisible GameObject is inactive in Needle — all sibling
        // components on this object will also have their start() skipped.
        // Keep MapAnchor on the object you want placed; put any always-running
        // logic components on a separate, always-visible GameObject.
        if (this.hideUntilLocalized) {
            this.gameObject.visible = false;
        }
    }

    onDestroy(): void {
        super.onDestroy();
        // Always remove listeners on destroy. If skipped, the adapter holds a
        // reference to this component's closures, preventing garbage collection
        // and causing callbacks to fire on a destroyed object.
        if (this._onLocalize) this._adapter?.removeLocalizationListener(this._onLocalize);
        if (this._onSessionEnd) this._adapter?.removeSessionEndListener(this._onSessionEnd);
        this._adapter = null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Wire this anchor to a NeedleAdapter so it receives localization events.
     * Called automatically by MultisetVPS for scene-placed anchors.
     * For runtime-spawned anchors, use adapter.registerAnchor(this) instead —
     * it calls this method and also replays the last localization result.
     *
     * Safe to call more than once: previous listeners are removed before the
     * new ones are registered, so no duplicate events accumulate.
     */
    connectAdapter(adapter: NeedleAdapter): void {
        // Deregister from the previous adapter before switching.
        // Without this, the old closures stay registered and fire duplicate
        // localization events on every subsequent result.
        if (this._adapter) {
            if (this._onLocalize) this._adapter.removeLocalizationListener(this._onLocalize);
            if (this._onSessionEnd) this._adapter.removeSessionEndListener(this._onSessionEnd);
        }
        this._adapter = adapter;
        this._registerListeners();
    }

    /**
     * Apply a localization result directly, bypassing the event system.
     * Called internally by NeedleAdapter.registerAnchor() to replay the last
     * result when a runtime anchor is registered mid-session.
     * You can also call this manually to force a re-placement (e.g. for testing).
     */
    applyLocalization(result: ILocalizeAndMapDetails, worldFromMap: THREE.Matrix4): void {
        this._onLocalize?.(result, worldFromMap);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private _registerListeners(): void {
        // Build the localization handler. This closure captures `this` so it can
        // read the latest Inspector values (offset, matchOrientation, etc.) at
        // the time each localization fires — not at registration time.
        this._onLocalize = (_result, worldFromMap) => {
            // ── Coordinate conversion ─────────────────────────────────────────
            // worldFromMap is always in Three.js (right-handed) space.
            // If the user entered offset in Unity (left-handed) space, convert:
            //   Position: negate X
            //   Rotation: negate Y and Z (follows from the X-axis reflection)
            const offset = this.isRightHanded
                ? this.offset.clone()
                : new THREE.Vector3(-this.offset.x, this.offset.y, this.offset.z);

            // Apply the offset in map space, then transform to world space.
            const worldPos = offset.applyMatrix4(worldFromMap);
            this.gameObject.position.copy(worldPos);

            if (this.matchOrientation) {
                // Extract the rotation component of worldFromMap.
                const q = new THREE.Quaternion();
                worldFromMap.decompose(new THREE.Vector3(), q, new THREE.Vector3());

                // Convert rotationOffset to Three.js space if needed.
                // Euler conversion: negate Y and Z (same axis rule as position).
                // The rotation order is preserved to avoid disturbing compound rotations.
                const rotEuler = this.isRightHanded
                    ? this.rotationOffset
                    : new THREE.Euler(
                        this.rotationOffset.x,
                        -this.rotationOffset.y,
                        -this.rotationOffset.z,
                        this.rotationOffset.order
                    );
                q.multiply(new THREE.Quaternion().setFromEuler(rotEuler));
                this.gameObject.quaternion.copy(q);
            }

            this.gameObject.visible = true;
        };

        // Re-hide the object when the session ends so it doesn't appear in the
        // preview at the wrong position until the next localization.
        this._onSessionEnd = () => {
            if (this.hideUntilLocalized) this.gameObject.visible = false;
        };

        this._adapter!.addLocalizationListener(this._onLocalize);
        this._adapter!.addSessionEndListener(this._onSessionEnd);
    }
}
