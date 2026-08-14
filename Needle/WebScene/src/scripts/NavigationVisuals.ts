/**
 * All navigation VISUALS for the MultiSet VPS Needle sample — path ribbon, POI labels, and the
 * navmesh debug overlay.
 *
 * THIS FILE IS YOURS. The SDK ships navigation essentials only: the state machine, pathfinding,
 * and `buildPathRibbon` (the ribbon triangles, which have one correct answer). Everything about
 * how navigation LOOKS is a design decision, so it lives here where you can change it.
 *
 * Contents:
 *   • createPathArrowMaterial / updatePathArrowMaterial — the scrolling-arrow shader
 *   • PathView    — a Mesh around buildPathRibbon + that material
 *   • LabelsView  — a billboarded name/distance label per POI
 *   • NavMeshView — translucent overlay of the walkable surface, for debugging
 *
 * Written in plain three.js with no Needle dependency, so the three.js sample uses it unchanged.
 */

import * as THREE from 'three';
import { buildPathRibbon, type IMapPOI } from '@multisetai/vps/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// Path: the scrolling-arrow shader, and a Mesh that rebuilds its ribbon geometry
// ─────────────────────────────────────────────────────────────────────────────

export interface IPathArrowMaterialOptions {
  /** Arrow texture, tiled along the path. Without one the ribbon is a plain solid strip. */
  map?: THREE.Texture | null;
  color?: THREE.ColorRepresentation;
  /**
   * Metres between the START of one arrow and the start of the next. Default 2.
   *
   * This is the repeat period, NOT the arrow's size — see `arrowLength`. Increase it for sparser
   * arrows with bigger gaps; it does not stretch them.
   */
  arrowSpacing?: number;
  /**
   * Metres that one arrow occupies along the path. Defaults to the ribbon width, which keeps a
   * SQUARE texture undistorted.
   *
   * Size and spacing have to be separate. If the texture were simply stretched across the whole
   * spacing interval — as an earlier version did — then a 0.35 m wide ribbon with 2 m spacing would
   * smear each arrow to 5.7x its natural length. Here the arrow occupies `arrowLength` and the
   * remainder of the interval is empty, so `arrowSpacing` controls the gap and nothing else.
   *
   * For a non-square texture, set this to `ribbonWidth * (textureWidth / textureHeight)`.
   */
  arrowLength?: number;
  /** Metres per second the arrows travel toward the destination. Default 1. Negative reverses. */
  scrollSpeed?: number;
  /** Brightness multiplier. Default 1. */
  intensity?: number;
  /** Overall alpha. Default 1. */
  opacity?: number;
}

/**
 * Scrolling-arrow material for the navigation path ribbon.
 *
 * Port of MultiSet's Unity `MultiSet/PathArrow` shader. The ribbon geometry supplies
 * `uv.x` as CUMULATIVE ARC LENGTH IN METRES (not normalised 0..1) — see PathVisualizer —
 * which is what makes arrows keep a constant real-world size and spacing no matter how
 * long the path is, and lets them scroll continuously across corners rather than
 * restarting per segment.
 *
 * Render state matches what AR passthrough needs: transparent, no depth write, drawn
 * after opaque geometry, and double-sided so the strip stays visible if a corner flips
 * its winding.
 */
export function createPathArrowMaterial(
  options: IPathArrowMaterialOptions = {}
): THREE.ShaderMaterial {
  const uniforms = {
    uMap: { value: options.map ?? null },
    uHasMap: { value: options.map ? 1 : 0 },
    uColor: { value: new THREE.Color(options.color ?? 0x33ccff) },
    uArrowSpacing: { value: options.arrowSpacing ?? 2 },
    // Defaults to the ribbon width so a square texture is undistorted. PathView passes its own
    // width through, so the default is correct without the caller thinking about it.
    uArrowLength: { value: options.arrowLength ?? 0.35 },
    uScrollSpeed: { value: options.scrollSpeed ?? 1 },
    uIntensity: { value: options.intensity ?? 1 },
    uOpacity: { value: options.opacity ?? 1 },
    // Scroll position in METRES along the path, not elapsed time. Accumulating distance
    // rather than time is what lets updatePathArrowMaterial wrap it exactly on the arrow
    // spacing, whatever the speed — a time-based value would only wrap cleanly at speed 1.
    uScrollOffset: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    // Draw after opaque scene geometry so the ribbon reads as painted onto the floor
    // rather than fighting it. Matches the Unity shader's Queue=Transparent.
    // (three.js default transparent queue is 1000-ish; 1 nudges it after siblings.)
    toneMapped: false,
    vertexShader: /* glsl */ `
      // uv.x = distance along the path in metres, uv.y = 0..1 across the ribbon width
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;

      uniform sampler2D uMap;
      uniform int   uHasMap;
      uniform vec3  uColor;
      uniform float uArrowSpacing;
      uniform float uArrowLength;
      uniform float uIntensity;
      uniform float uOpacity;
      uniform float uScrollOffset;

      varying vec2 vUv;

      void main() {
        // vUv.x is METRES along the path (see buildPathRibbon's vertex contract), so all of this
        // is in real-world units.
        //
        // One arrow every uArrowSpacing metres, each occupying uArrowLength of that interval; the
        // remainder is a gap. Mapping the texture across the WHOLE interval instead — the obvious
        // shortcut — stretches every arrow by spacing/width, which for the defaults is 5.7x.
        //
        // fract() handles negative offsets correctly, so scrolling backwards needs no sign juggling.
        float along = vUv.x - uScrollOffset;
        float cell  = fract(along / max(uArrowSpacing, 0.0001));
        float u     = cell * uArrowSpacing / max(uArrowLength, 0.0001);
        if (u > 1.0) discard;                 // inside the gap between two arrows

        vec2 arrowUv = vec2(u, vUv.y);

        vec4 texel = vec4(1.0);
        if (uHasMap == 1) {
          texel = texture2D(uMap, arrowUv);
          // The texture is treated as an ALPHA MASK: colour comes from uColor, not from the
          // texture's RGB. Arrow art is conventionally drawn as a silhouette in the alpha channel
          // with black or white RGB — multiplying by that RGB would give black arrows whatever
          // uColor was set to, or ignore uColor entirely. This is also how the Unity material
          // used the same PNG.
          texel = vec4(1.0, 1.0, 1.0, texel.a);
        } else {
          // No texture: fade out towards both edges so the strip has soft sides
          // instead of a hard aliased border.
          float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
          texel = vec4(1.0, 1.0, 1.0, edge);
        }

        vec3 rgb = texel.rgb * uColor * uIntensity;
        float alpha = texel.a * uOpacity;
        if (alpha < 0.01) discard;   // keep fully transparent gaps out of the depth sort
        gl_FragColor = vec4(rgb, alpha);
      }
    `,
  });

  material.name = 'PathArrowMaterial';
  return material;
}

/**
 * Advance the scroll animation.
 *
 * Call once per tick with the frame delta — `Navigation`'s `tick` event supplies one that
 * works both inside an XR session and in the desktop preview.
 */
export function updatePathArrowMaterial(
  material: THREE.ShaderMaterial,
  deltaSeconds: number
): void {
  const offset = material.uniforms.uScrollOffset;
  if (!offset) return;
  const speed = (material.uniforms.uScrollSpeed?.value as number) ?? 1;
  const spacing = (material.uniforms.uArrowSpacing?.value as number) || 1;
  // Wrap on exactly one arrow repeat. The pattern is identical either side of the wrap, so
  // it is invisible, and the uniform never grows large enough to lose float32 precision —
  // which an un-wrapped value would, after long continuous use.
  offset.value = (offset.value + deltaSeconds * speed) % spacing;
}

export interface IPathViewOptions extends IPathArrowMaterialOptions {
  /** Ribbon width in metres. Default 0.35. */
  width?: number;
  /** Metres above the floor. Raise it if the ribbon z-fights. Default 0.1. */
  heightAboveFloor?: number;
  /** Radius used to round off corners, in metres. Default 0.4. 0 gives sharp corners. */
  cornerRadius?: number;
}

/**
 * A path ribbon you can drop under MapSpace.
 *
 * Geometry comes from the package (`buildPathRibbon`); the material and the Mesh are ours. That
 * split is the whole point: swap `createPathArrowMaterial` for anything that honours the vertex
 * contract — `uv.x` = metres along the path, `uv.y` = 0..1 across.
 */
export class PathView {
  private readonly _mesh: THREE.Mesh;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _opts: IPathViewOptions;

  constructor(options: IPathViewOptions = {}) {
    this._opts = options;
    // Default the arrow's LENGTH to the ribbon's width, so a square texture comes out
    // undistorted without the caller having to work that out. Written as an explicit ?? rather
    // than relying on spread order, which would break if a caller passed arrowLength: undefined.
    const width = options.width ?? 0.35;
    this._material = createPathArrowMaterial({
      ...options,
      arrowLength: options.arrowLength ?? width,
    });
    this._mesh = new THREE.Mesh(new THREE.BufferGeometry(), this._material);
    this._mesh.name = 'NavigationPath';
    this._mesh.visible = false;
    // Geometry is rebuilt from scratch on every path change, so a cached bounding sphere
    // would be stale; skip culling rather than recompute it each time.
    this._mesh.frustumCulled = false;
  }

  get object(): THREE.Object3D { return this._mesh; }
  get material(): THREE.ShaderMaterial { return this._material; }

  /** Feed corners straight from Navigation's `pathUpdated` event. */
  setPath(corners: readonly THREE.Vector3[]): void {
    this._mesh.geometry.dispose();
    this._mesh.geometry = buildPathRibbon(corners, this._opts);
    this._mesh.visible = this._mesh.geometry.getAttribute('position') !== undefined;
  }

  clear(): void {
    this._mesh.geometry.dispose();
    this._mesh.geometry = new THREE.BufferGeometry();
    this._mesh.visible = false;
  }

  /** Advance the arrow scroll. Drive from Navigation's `tick` event. */
  update(deltaSeconds: number): void {
    updatePathArrowMaterial(this._material, deltaSeconds);
  }

  dispose(): void {
    this._mesh.geometry.dispose();
    this._material.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels: one billboarded plate per POI
// ─────────────────────────────────────────────────────────────────────────────

/** Content for one POI label, plus how to refresh its distance line. */
export interface IPOILabel {
  /** The visual. Positioned and billboarded for you; its own origin is its centre. */
  object: THREE.Object3D;
  /**
   * Called when the walking distance changes by a whole metre, and once on creation.
   * `metres` is negative when unknown (not localized, or unreachable).
   * Omit if your label does not show distance.
   */
  setDistance?: (metres: number) => void;
  /** Release anything you allocated. Called on removal and on dispose(). */
  dispose?: () => void;
}

export interface ILabelsViewOptions {
  /**
   * Build your own label for each POI, replacing the built-in text plate entirely.
   *
   * This is the extension point for icons per `MapPOIType`, thumbnails, Needle prefabs,
   * video planes — anything that is an `Object3D`. POIVisualizer keeps doing the parts worth
   * sharing: positioning at the POI, y-locked billboarding, distance culling, and throttling
   * refreshes to whole-metre changes.
   *
   * ```ts
   * new POIVisualizer({
   *   createLabel: poi => {
   *     const icon = iconForType(poi.type);
   *     return { object: icon, dispose: () => icon.geometry.dispose() };
   *   },
   * });
   * ```
   */
  createLabel?: (poi: IMapPOI) => IPOILabel;
  /** World height of a label in metres. Default 0.32. */
  labelHeight?: number;
  /** Metres above the POI position. Default 0.4, so a floor-level POI is not underfoot. */
  heightOffset?: number;
  /** Hide labels further away than this, in metres. Default 40. 0 disables the cutoff. */
  maxVisibleDistance?: number;
  /** Show a walking distance under the name. Default true. */
  showDistance?: boolean;
  /** Draw labels over scene geometry instead of being occluded by it. Default false. */
  renderOnTop?: boolean;
  textColor?: string;
  backgroundColor?: string;
  /** Text colour of the distance line. Default a dimmed white. */
  distanceColor?: string;
}

const DEFAULTS = {
  labelHeight: 0.32,
  heightOffset: 0.4,
  maxVisibleDistance: 40,
  showDistance: true,
  renderOnTop: false,
  textColor: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.65)',
  distanceColor: 'rgba(255,255,255,0.7)',
} as const;

/** Canvas pixels per metre of label height. Fixed so text is crisp on phone displays. */
const PIXELS_PER_METRE = 220;

interface IMarker {
  poi: IMapPOI;
  label: IPOILabel;
  /** Set only for the built-in label; null when the caller supplied `createLabel`. */
  builtin: IBuiltinLabel | null;
  /** Last distance pushed, in whole metres, so refreshes only happen when it changes. */
  drawnDistance: number | null;
}

interface IBuiltinLabel {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  geometry: THREE.PlaneGeometry;
}

/**
 * Positions, billboards and culls one label per POI.
 *
 * The reusable mechanism lives here; the label's APPEARANCE is yours via `createLabel`.
 * What you get for free either way:
 *   • placement at the POI position, plus `heightOffset`
 *   • y-locked billboarding, matching Unity's `TurnToCamera` — labels turn to face the
 *     viewer but stay upright. A `Sprite` would also tilt, so a floor-level label reads as
 *     falling over when you look down at it
 *   • distance culling via `maxVisibleDistance`
 *   • distance refreshes throttled to whole-metre changes
 *
 * Deliberately knows nothing about `Navigation` — it takes POIs and, optionally, distances.
 * That keeps it usable for plain signage in scenes with no wayfinding at all.
 *
 * ```ts
 * const markers = new POIVisualizer();
 * mapSpace.object.add(markers.object);
 * markers.setPOIs(navigation.pois);
 * navigation.on('tick', () => {
 *   for (const poi of navigation.pois) markers.setDistance(poi.id, navigation.distanceTo(poi));
 *   markers.update(camera);
 * });
 * ```
 *
 * Labels are meshes with a y-locked `lookAt`, matching the semantics of Unity's
 * `TurnToCamera`: they rotate horizontally to face the viewer but stay upright. A `Sprite`
 * would also tilt when the user looks down at a floor-level POI, which reads as the label
 * falling over.
 */
export class LabelsView {
  private readonly _group = new THREE.Group();
  private readonly _opts: Required<Omit<ILabelsViewOptions, 'createLabel'>>
    & Pick<ILabelsViewOptions, 'createLabel'>;
  private readonly _markers = new Map<string, IMarker>();
  private readonly _distances = new Map<string, number>();

  // Scratch: update() runs every frame.
  private readonly _cameraPos = new THREE.Vector3();
  private readonly _target = new THREE.Vector3();
  private readonly _markerWorld = new THREE.Vector3();

  constructor(options: ILabelsViewOptions = {}) {
    this._opts = { ...DEFAULTS, ...options };
    this._group.name = 'POIMarkers';
  }

  /** Add this to the MapSpace object — POI positions are map coordinates. */
  get object(): THREE.Object3D {
    return this._group;
  }

  /** Replace all markers. Existing markers for unchanged ids are rebuilt, not reused. */
  setPOIs(pois: readonly IMapPOI[]): void {
    this.clear();
    for (const poi of pois) this.addPOI(poi);
  }

  addPOI(poi: IMapPOI): void {
    this.removePOI(poi.id);
    const marker = this._opts.createLabel
      ? this._createCustomMarker(poi, this._opts.createLabel(poi))
      : this._createBuiltinMarker(poi);
    this._markers.set(poi.id, marker);
    this._group.add(marker.label.object);
  }

  removePOI(id: string): void {
    const marker = this._markers.get(id);
    if (!marker) return;
    this._group.remove(marker.label.object);
    marker.label.dispose?.();
    this._markers.delete(id);
  }

  clear(): void {
    for (const marker of this._markers.values()) {
      this._group.remove(marker.label.object);
      marker.label.dispose?.();
    }
    this._markers.clear();
  }

  /**
   * Set the walking distance shown under a POI's name, in metres.
   * A negative value (Navigation's "unknown") hides the line.
   */
  setDistance(id: string, metres: number): void {
    this._distances.set(id, metres);
  }

  /**
   * Face the labels at the camera and apply the distance cutoff.
   * Drive from Navigation's `tick` event so it also runs in the non-AR preview.
   */
  update(camera: THREE.Camera): void {
    if (this._markers.size === 0) return;
    camera.getWorldPosition(this._cameraPos);
    const cutoff = this._opts.maxVisibleDistance;

    for (const marker of this._markers.values()) {
      const object = marker.label.object;
      object.getWorldPosition(this._markerWorld);

      if (cutoff > 0) {
        const visible = this._markerWorld.distanceTo(this._cameraPos) <= cutoff;
        object.visible = visible;
        if (!visible) continue;
      }

      // Y-locked: look at the camera's horizontal position only, so the label stays upright.
      this._target.set(this._cameraPos.x, this._markerWorld.y, this._cameraPos.z);
      object.lookAt(this._target);

      this._refreshDistance(marker);
    }
  }

  dispose(): void {
    this.clear();
    this._distances.clear();
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private _refreshDistance(marker: IMarker): void {
    if (!marker.label.setDistance) return;
    const raw = this._distances.get(marker.poi.id);
    // Round before comparing. For the built-in label this avoids redrawing a canvas and
    // re-uploading its texture 60 times a second; a custom label gets the same guarantee,
    // so setDistance is safe to make expensive.
    const rounded = raw === undefined || raw < 0 ? null : Math.round(raw);
    if (rounded === marker.drawnDistance) return;
    marker.drawnDistance = rounded;
    marker.label.setDistance(rounded ?? -1);
  }

  /** Wrap a caller-supplied label, positioning it like a built-in one. */
  private _createCustomMarker(poi: IMapPOI, label: IPOILabel): IMarker {
    label.object.position.copy(poi.position).setY(poi.position.y + this._opts.heightOffset);
    if (!label.object.name) label.object.name = `POI:${poi.id}`;
    const marker: IMarker = { poi, label, builtin: null, drawnDistance: null };
    // Push the current distance immediately so a label does not show a blank line until the
    // viewer happens to move a whole metre.
    this._refreshDistance(marker);
    return marker;
  }

  private _createBuiltinMarker(poi: IMapPOI): IMarker {
    const canvas = document.createElement('canvas');
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: !this._opts.renderOnTop,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // Geometry is sized in _draw(), once the canvas aspect is known.
    const geometry = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `POI:${poi.id}`;
    mesh.position.copy(poi.position).setY(poi.position.y + this._opts.heightOffset);
    if (this._opts.renderOnTop) mesh.renderOrder = 10;

    const builtin: IBuiltinLabel = { mesh, canvas, texture, material, geometry };
    const marker: IMarker = {
      poi,
      builtin,
      drawnDistance: null,
      label: {
        object: mesh,
        setDistance: this._opts.showDistance
          ? metres => {
              this._draw(marker);
              texture.needsUpdate = true;
              void metres;   // read from marker.drawnDistance, already rounded
            }
          : undefined,
        dispose: () => {
          geometry.dispose();
          material.dispose();
          texture.dispose();
        },
      },
    };
    this._draw(marker);
    return marker;
  }

  /** Render the built-in label to its canvas and resize the plane to match its aspect. */
  private _draw(marker: IMarker): void {
    const builtin = marker.builtin;
    if (!builtin) return;
    const { labelHeight, textColor, backgroundColor, distanceColor, showDistance } = this._opts;
    const distance = marker.drawnDistance;
    const distanceText = showDistance && distance !== null ? `${distance} m` : '';

    const nameSize = 44;
    const distanceSize = 30;
    const padX = 28;
    const padY = 18;
    const gap = distanceText ? 8 : 0;

    const canvas = builtin.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previousWidth = canvas.width;
    const previousHeight = canvas.height;

    // Measure first, on a throwaway state, so the canvas can be sized to the text.
    ctx.font = `600 ${nameSize}px system-ui, -apple-system, sans-serif`;
    const nameWidth = ctx.measureText(marker.poi.name).width;
    ctx.font = `400 ${distanceSize}px system-ui, -apple-system, sans-serif`;
    const distanceWidth = distanceText ? ctx.measureText(distanceText).width : 0;

    const contentWidth = Math.max(nameWidth, distanceWidth);
    const contentHeight = nameSize + gap + (distanceText ? distanceSize : 0);
    canvas.width = Math.ceil(contentWidth + padX * 2);
    canvas.height = Math.ceil(contentHeight + padY * 2);

    // A resized canvas needs a NEW GPU texture, not an update of the old one. three.js would
    // otherwise re-upload the larger canvas into the allocation made for the smaller one,
    // which Chrome rejects with
    //   GL_INVALID_VALUE: glCopySubTextureCHROMIUM: Offset overflows texture dimensions
    // and the label silently stops updating. Disposing forces a full reallocation.
    // This fires on the first distance update of every label: the initial draw has no
    // distance line, and adding one makes the canvas taller.
    if (canvas.width !== previousWidth || canvas.height !== previousHeight) {
      builtin.texture.dispose();
    }

    // Resizing the canvas resets its context state, so all drawing happens after this point.
    const radius = Math.min(canvas.height / 2, 26);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = backgroundColor;
    roundedRect(ctx, 0, 0, canvas.width, canvas.height, radius);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.font = `600 ${nameSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(marker.poi.name, canvas.width / 2, padY);

    if (distanceText) {
      ctx.fillStyle = distanceColor;
      ctx.font = `400 ${distanceSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(distanceText, canvas.width / 2, padY + nameSize + gap);
    }

    // Keep a constant world HEIGHT and let width follow the text, so long names get wider
    // labels rather than smaller text.
    const height = Math.max(canvas.height / PIXELS_PER_METRE, labelHeight);
    const width = height * (canvas.width / canvas.height);
    builtin.mesh.scale.set(width, height, 1);
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


// ─────────────────────────────────────────────────────────────────────────────
// NavMesh debug overlay
// ─────────────────────────────────────────────────────────────────────────────

export interface INavMeshViewOptions {
  /** Surface tint. Default semi-transparent green, matching Unity's ShowNavMesh. */
  color?: THREE.ColorRepresentation;
  /** Surface alpha. Default 0.3. */
  opacity?: number;
  /** Metres above the navmesh, to avoid z-fighting the floor it sits on. Default 0.01. */
  heightOffset?: number;
  /** Draw triangle edges on top of the surface. Default true — it is what makes gaps obvious. */
  wireframe?: boolean;
}

/**
 * Renders the walkable surface for debugging.
 *
 * Port of Unity's `ShowNavMesh`, and the single most useful thing to switch on when a
 * customer reports that navigation "does nothing": it shows immediately whether the navmesh
 * exported at all, whether it is in the right place, and whether the region the user is
 * standing in connects to the one they are trying to reach.
 *
 * ```ts
 * const debug = new NavMeshDebug(pathfinder.geometry);
 * mapSpace.object.add(debug.object);
 * debug.visible = false;   // toggle from your UI
 * ```
 *
 * Parent it to the MapSpace object: the geometry is in map space, like everything else.
 */
export class NavMeshView {
  private readonly _group = new THREE.Group();
  private readonly _surface: THREE.Mesh;
  private readonly _lines: THREE.LineSegments | null = null;
  private readonly _surfaceMaterial: THREE.MeshBasicMaterial;
  private readonly _lineMaterial: THREE.LineBasicMaterial | null = null;
  private readonly _wireGeometry: THREE.WireframeGeometry | null = null;

  constructor(geometry: THREE.BufferGeometry, options: INavMeshViewOptions = {}) {
    const color = options.color ?? 0x00ff00;

    this._surfaceMaterial = new THREE.MeshBasicMaterial({
      color,
      opacity: options.opacity ?? 0.3,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    // Shares the pathfinder's geometry rather than cloning it — a navmesh can be large, and
    // this object must not be the reason a scene doubles its vertex memory. Consequently
    // dispose() does NOT dispose the geometry; the pathfinder owns it.
    this._surface = new THREE.Mesh(geometry, this._surfaceMaterial);
    this._surface.name = 'NavMeshDebugSurface';
    this._surface.frustumCulled = false;
    this._group.add(this._surface);

    if (options.wireframe !== false) {
      this._wireGeometry = new THREE.WireframeGeometry(geometry);
      this._lineMaterial = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
      });
      this._lines = new THREE.LineSegments(this._wireGeometry, this._lineMaterial);
      this._lines.name = 'NavMeshDebugWireframe';
      this._lines.frustumCulled = false;
      this._group.add(this._lines);
    }

    this._group.name = 'NavMeshDebug';
    this._group.position.y = options.heightOffset ?? 0.01;
  }

  /** Add this to the MapSpace object. */
  get object(): THREE.Object3D {
    return this._group;
  }

  get visible(): boolean {
    return this._group.visible;
  }

  set visible(value: boolean) {
    this._group.visible = value;
  }

  /** Disposes only what this object created. The shared navmesh geometry is left alone. */
  dispose(): void {
    this._surfaceMaterial.dispose();
    this._lineMaterial?.dispose();
    this._wireGeometry?.dispose();
    this._group.clear();
  }
}
