import { Behaviour, serializable } from '@needle-tools/engine';
import { MapPOIType } from './MapPOIType.js';

/**
 * One navigable destination inside a scanned VPS map.
 *
 * Add this component to a GameObject and place that GameObject where the destination is. Its
 * position IS the map coordinate — paste the value from the developer portal's Map Viewer into
 * the normal Unity Transform. MultisetNavigation finds every MapPOI in the scene at startup and
 * builds the destination list from them; no code required.
 *
 * ── Placement ────────────────────────────────────────────────────────────────
 * Put these anywhere under the MapSpace root. Nesting is fine — MultisetNavigation converts
 * each one relative to MapSpace, so a tidy Map Space/Content/POIs/... hierarchy works exactly
 * like putting them at the root.
 *
 * Place them ON or NEAR the walkable surface. A destination floating more than about 2 metres
 * off the navmesh cannot be routed to and is reported as unreachable.
 *
 * ── Runtime destinations ─────────────────────────────────────────────────────
 * POIs coming from your own backend do not need this component at all — call
 * navigation.setPOIs() or addPOI() with plain objects instead, converting portal coordinates
 * with MapSpace.toLocal().
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MapPOI extends Behaviour {

    // NOTE: never use a double quote in a @serializable field's doc comment. Needle copies the
    // comment verbatim into a C# Tooltip attribute without escaping, so a quote closes the C#
    // string early and the generated file fails to compile with CS1003. Use 'single quotes'.

    /** Name shown in the destination list and on the label. */
    @serializable()
    poiName: string = "";

    /**
     * Stable id used by navigation.setDestination(). Leave empty to use the GameObject name.
     * Set it explicitly if you rename objects, or if two POIs share a name.
     */
    @serializable()
    poiId: string = "";

    /** Kind of place. Used to pick an icon; navigation treats every type the same. */
    @serializable()
    poiType: MapPOIType = MapPOIType.Room;

    /** Metres from this POI that count as arrival. 0 = use the value on MultisetNavigation. */
    @serializable()
    arrivalRadius: number = 0;

    /** Optional longer text, for your own UI to display. */
    @serializable()
    description: string = "";

    /** Id actually used at runtime: poiId when set, otherwise the GameObject name. */
    get resolvedId(): string {
        return this.poiId.trim() || this.gameObject.name;
    }

    /** Label actually used at runtime: poiName when set, otherwise the GameObject name. */
    get resolvedName(): string {
        return this.poiName.trim() || this.gameObject.name;
    }
}
