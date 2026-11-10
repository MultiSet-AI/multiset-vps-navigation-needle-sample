# MultiSet VPS — AR Navigation Sample (Needle Engine / Unity)

Indoor AR wayfinding on top of MultiSet VPS localization: pick a destination, follow an arrowed
path along the floor, arrive.

Built with [`@multisetai/vps`](https://www.npmjs.com/package/@multisetai/vps) and
[Needle Engine](https://needle.tools) — authored in Unity, runs in a browser on Android.

---

## Contents

- [What this sample is](#what-this-sample-is)
- [Requirements](#requirements)
- [Part 1 — Get it running (30 min)](#part-1--get-it-running)
  - [1. Clone and install](#1-clone-and-install)
  - [2. Open in Unity](#2-open-in-unity)
  - [3. Add your credentials](#3-add-your-credentials)
  - [4. Whitelist your domain](#4-whitelist-your-domain-cors)
  - [5. Create a navmesh](#5-create-a-navmesh)
  - [6. Import the navmesh into Unity](#6-import-the-navmesh-into-unity)
  - [7. Place your destinations](#7-place-your-destinations)
  - [8. Check the scene wiring](#8-check-the-scene-wiring)
  - [9. Run it on a phone](#9-run-it-on-a-phone)
  - [10. What you should see](#10-what-you-should-see)
- [Part 2 — The project](#part-2--the-project)
  - [Scene structure](#scene-structure)
  - [The files](#the-files)
  - [Inspector reference](#inspector-reference)
  - [Runtime settings panel](#runtime-settings-panel)
- [Part 3 — Customising](#part-3--customising)
- [Troubleshooting](#troubleshooting)
- [Updating the SDK](#updating-the-sdk)

---

## What this sample is

The SDK ships navigation **essentials**: the state machine, pathfinding, and the ribbon geometry.
It deliberately ships **no UI, no shaders and no label design**, because those are decisions every
app makes differently.

**This repo is the other half** — a complete, working navigation app. Everything visual lives here,
in files you own and can rewrite.

---

## Requirements

| | |
|---|---|
| **Unity** | 6000.4+ with **URP**. This project is on 6000.4.11f1 |
| **Needle Engine** | The Unity exporter package |
| **Node.js** | 18+ |
| **Device** | Android with ARCore, Chrome 81+, served over **HTTPS** |
| **MultiSet** | An account with at least one scanned map ([developer portal](https://developer.multiset.ai)) |

> **iOS is not supported.** This SDK needs the `camera-access` WebXR feature, which Safari does not
> implement. There is no workaround.

---

# Part 1 — Get it running

## 1. Clone and install

```bash
git clone <this-repo>
cd multiset-vps-navigation-needle-sample/Needle/WebScene
npm install
```

That installs Needle Engine, `@multisetai/vps`, and `three-pathfinding`.

**Verify you have exactly one copy of three.js**, which matters because Needle uses its own fork:

```bash
npm ls three
```

Every entry must resolve to `@needle-tools/three@0.169.19`. npm may label it `deduped` or
`overridden` depending on how it resolved; either is fine. What matters is that no entry shows a
plain `three@0.x` version. If one does, check that `package.json` still contains:

```json
"overrides": { "three": "npm:@needle-tools/three@0.169.19" }
```

…then delete `node_modules` and `package-lock.json` and reinstall. Two copies of three.js cause
symptoms that look unrelated to the cause.

## 2. Open in Unity

Add the project folder in Unity Hub and open it with **6000.4 or newer**. First open takes a few
minutes while Unity imports assets and Needle generates C# components.

When it finishes, confirm codegen worked — you should have these files:

```
Assets/Needle/Components.codegen/
├── MultisetVPS.cs
├── MapSpace.cs
├── MapAnchor.cs
├── MapPOI.cs
└── MultisetNavigation.cs
```

Those are auto-generated stubs that let Unity show your TypeScript components in the Inspector. If
they are missing, or the Console shows compile errors, see
[Troubleshooting](#codegen-didnt-run-or-components-dont-appear).

Open **`Assets/Scenes/SampleScene.unity`**.

## 3. Add your credentials

In the Hierarchy, select **`MultisetVPS`** and fill in **Map Code**, plus **one** way to sign in:

| Inspector field | Where to get it |
|---|---|
| **Map Code** | Developer portal → your map. Looks like `MAP_XXXXXXXXXXXX` |
| **Client Id** + **Client Secret** | Developer portal → **Credentials**. Quickest for trying the sample, but both end up in the page — prototyping only |
| **Token Url** | **Or** the address of a token endpoint on your own server, which returns `{ token, expiresOn }`. The secret stays on your server. Leave Client Id and Client Secret empty |

Token Url takes precedence when both are set. Setting up the endpoint is covered in
[Authentication](https://docs.multiset.ai/web-sdk/webxr-sdk/authentication); it must allow your
app's origin with CORS headers if it runs on another host or port.

Leave **Map Type** as `SingleMap`.

Also tick **Show Mesh** for now.

That overlays the scanned map mesh at runtime, drawn as a **translucent purple surface with a yellow
grid** — grid lines every 2 metres, which doubles as a scale reference. It is the fastest way to
confirm your content is aligned with the real world: if the purple mesh lines up with the actual
room, localization is correct.

**Untick `Show Mesh` on `MultisetVPS` once you are happy with alignment.** It is a setup aid, not
part of the experience — leaving it on covers the room in purple and costs a mesh download on every
localization.

Two related fields on the same component:

| Field | What it does |
|---|---|
| **Show Mesh** | The purple + yellow-grid overlay of the scanned map. Turn **off** for production |
| **Show Gizmo** | A small coordinate-axis marker at the map origin. Useful for seeing where Y = 0 actually is, and how the axes are oriented |

> ⚠️ **Credentials end up in the scene file.** They are Inspector values, so
> `Assets/Scenes/SampleScene.unity` will contain them once you save, and the exported page ships
> them to every visitor. Do not push that to a public repository, and switch to **Token Url**
> before you publish.

## 4. Whitelist your domain (CORS)

The SDK calls the MultiSet API directly from the browser, so your origin must be allowed:

1. Developer portal → **Credentials → Settings → Domains**
2. **Add +**
3. Enter the origin Needle serves from — usually `https://localhost:3000`, plus your LAN address
   such as `https://192.168.1.14:3000` if you test on a phone over Wi-Fi

Skip this and **every** API request fails with a CORS error before localization is even attempted.

## 5. Create a navmesh

Navigation needs a **triangulated walkable surface** — an ordinary mesh, exported with your scene.

Generate it in the browser:

**a.** Developer portal → your map → download the **3D Mesh (.glb)**. Take the **raw** mesh, not the
textured one — pathfinding only reads geometry, and textures are tens of MB of dead weight.

**b.** Open **[navmesh.isaacmason.com](https://navmesh.isaacmason.com/)** and drag the `.glb` in.

**c.** Set the generation config. Note that **Walkable Radius, Climb and Height are in voxels** —
multiples of Cell Size / Cell Height — which is why the numbers look small:

| Setting | Value | Why |
|---|---|---|
| Cell Size | `0.10` | Resolution. Smaller is more faithful but slower |
| Cell Height | `0.10` | |
| Walkable Slope Angle | `60` | Permissive — scanned floors are bumpy |
| Walkable Height | `8` | 0.8 m clearance. Low on purpose; we want coverage, not headroom accuracy |
| Walkable Climb | `3` | 0.3 m — steps over scan noise instead of treating it as a wall |
| Walkable Radius | `1` | 0.1 m erosion. Keeps doorways open |
| Min Region Area | `2` | Stops small connecting regions being culled |

Untick **Keep Intermediates** on a large scan to save memory.

**d.** Click **Generate NavMesh**. You should see teal polygons over the floor. If nothing appears,
see [Troubleshooting](#the-recast-tool-exports-an-empty-file).

**e. Test connectivity before exporting.** This is the highest-value 30 seconds in the whole setup.
Under **Display Options → Test Agent**, tick **Enabled**. Right-click to teleport the agent into one
room, left-click a target in another. **If the agent walks there, the navmesh is sound.** If it
refuses, the navmesh is torn and no amount of Unity work will fix it — raise Cell Size and
regenerate.

Do this for every pair of rooms you care about.

**f. Export — and verify the file before trusting it.**

Click **Export as GLB**. Do *not* use **Export as Recast NavMesh** — that is recast's own binary
format, which neither Unity nor this SDK can read.

First check the size:

```bash
ls -la ~/Downloads/navmesh.glb
```

A real navmesh for a room-sized space is a few KB up to a few hundred KB. **A file of only a few
bytes means nothing was generated** — go back and press **Generate NavMesh** first, since export
writes out the last generated result.

**Then confirm it actually opens.** The tool's GLB export is unreliable and can produce a file that
looks plausible but no viewer will load. Drop it into any online glTF viewer —
[gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/) is fine — and check the geometry
appears.

**If the GLB will not load, export GLTF instead and convert it:**

1. In the navmesh tool, click **Export as GLTF**
2. Open the [three.js editor](https://threejs.org/editor/)
3. Drag the `.gltf` file into the editor window — the navmesh should appear in the viewport
4. **File → Export GLB**
5. Use that GLB in the next step

Converting through the editor is a plain re-serialisation: the geometry and coordinate frame are
unchanged, so the result drops into Unity exactly like a working direct export would.

## 6. Import the navmesh into Unity

**a.** Drag `navmesh.glb` into **`Assets/NavMesh/`** in the Project window. Unity imports it via
UnityGLTF, which ships with Needle.

**b.** Drag that asset **from the Project window into the Hierarchy**, as a child of **`Map Space`**.

> These are two different drags. The first adds a file to your project; the second puts an object in
> the scene. Only the second one matters for navigation.

**c.** Rename it `navmesh`, then **zero its Transform**:

```
Position  0, 0, 0
Rotation  0, 0, 0
Scale     1, 1, 1
```

This is not optional. The navmesh is already in map coordinates because it was generated from the
map mesh, so any transform on it applies the offset a second time. A displaced navmesh is the single
most common setup mistake.

**d.** Select **`Multiset Navigation`** and drag the `navmesh` object **from the Hierarchy** into its
**Nav Mesh** field. Dragging the Project asset will not work — the field is a `Transform` reference
to a scene object.

**e.** Tick **Show Nav Mesh Debug** for your first run.

## 7. Place your destinations

Each destination is a GameObject with a **`MapPOI`** component, nested anywhere under `Map Space`.
The sample ships three under `Map Space/POIs`.

For each one:

**a.** Select it and set **Poi Name** — this is the label users see (`Kitchen`, `Reception`, …).

**b.** Position it **over the navmesh**. The navmesh renderer is visible in the editor, so drag until
the POI sits above the walkable surface.

**Height does not matter.** A POI's Y is treated as an authoring accident and it is projected down
onto the floor automatically. What *does* matter is horizontal position — more than **1 m** outside
the walkable area and it reports "no route", because a metre sideways is a different place, not a
rounding error.

> **The map origin is usually not the floor.** On a typical scan the floor sits about a metre *below*
> Y = 0, because the origin is roughly where the scanner was held. Content authored "at Y = 0"
> therefore floats at chest height. Harmless for POIs — but it is why the navmesh looks low.

**c.** Leave **Poi Id** empty (it falls back to the GameObject name) and **Arrival Radius** at `0`
(uses the global 1.5 m).

To add more: duplicate an existing POI, rename it, move it, change its **Poi Name**. They are
discovered automatically — no list to maintain.

## 8. Check the scene wiring

Before running, confirm all five:

- [ ] **`Map Space`** Transform is `0,0,0` / no rotation / scale `1`
- [ ] **`navmesh`** is a child of `Map Space`, also at identity
- [ ] **`Multiset Navigation`** is at the scene **root**, *not* under `Map Space`
- [ ] There is exactly **one** `Multiset Navigation` in the scene
- [ ] Its **Nav Mesh** field is assigned

> Why `Multiset Navigation` must be outside `Map Space`: `MapSpace.hideUntilLocalized` hides its
> subtree until the first localization, Needle treats an invisible GameObject as **inactive**, and an
> inactive component never runs `update()`. Nested there, navigation would silently never start.

Also make sure there is **no Needle `WebXR` component** anywhere in the scene. `MultisetVPS` owns the
WebXR session; two session managers conflict and the camera feed stays black.

**Save the scene** (⌘S / Ctrl+S).

## 9. Run it on a phone

**a.** Press Needle's **play / preview** button in Unity. It exports the scene and starts a Vite dev
server, printing a URL like `https://192.168.1.14:3000`.

**b.** Open that URL on your Android phone, on the same Wi-Fi. Accept the self-signed certificate
warning — HTTPS is mandatory for WebXR.

**c.** Tap **START AR** and grant camera permission.

**d.** Point the camera at part of the space you scanned, and hold reasonably still. Localization
needs recognisable visual features — a blank wall will not work.

## 10. What you should see

In order:

1. Console: `[MultisetVPS] Authorized`
2. Console: `[MultisetVPS] Localization failed: All attempts failed to produce a pose` — **this is
   normal.** It is the automatic first attempt firing before you aimed the camera
3. Console: `[MultisetVPS] Localization success — confidence: 0.5xx`
4. **On screen:** the scanned map mesh overlaid on the real room (because `Show Mesh` is on), a
   translucent green navmesh overlay, and floating name labels above each POI
5. The bottom button changes from `LOCALIZING…` to **`DESTINATIONS`**
6. A **gear button** in the top-right corner (there since authorization) opens the
   [runtime settings panel](#runtime-settings-panel)

Then:

7. Tap **DESTINATIONS** → your POIs, sorted nearest-first with live distances
8. Pick one → a cyan arrowed ribbon appears on the floor, arrows flowing toward the destination, and
   a HUD shows the name, remaining distance and a progress bar
9. Walk toward it → distance counts down, the bar fills
10. Get within 1.5 m → arrival toast, ribbon disappears

**Check the console for `[NavMeshPathfinder] The navmesh has N disconnected regions`.** On a
single-floor space you want no such warning — see
[Troubleshooting](#every-destination-says-no-route).

Once you are happy with alignment, untick **Show Mesh** and **Show Nav Mesh Debug**.

---

# Part 2 — The project

## Scene structure

```
SampleScene
├── Main Camera                 the AR camera
├── Directional Light
├── Needle Engine               ExportInfo — Needle's own component
├── MultisetVPS                 credentials + owns the WebXR session
├── Map Space                   MapSpace — the map coordinate frame. MUST be at identity
│   ├── navmesh                 your navmesh GLB. MUST be at identity
│   └── POIs
│       ├── Kitchen             MapPOI
│       ├── Desk                MapPOI
│       └── Entrance            MapPOI
└── Multiset Navigation         MultisetNavigation + VPSSettings — OUTSIDE Map Space
```

**Why `Map Space` matters.** On every localization it is moved so its origin matches the scanned
map's origin, and every descendant follows by ordinary parenting. So **a child's local position is
its map coordinate** — you can paste values straight from the portal's Map Viewer. It also means
relocalization is free: only this one transform changes, and nothing computed relative to it needs
recalculating.

## The files

Everything in `Needle/WebScene/src/scripts/` is TypeScript you own.

### Sample code — change freely

| File | What it owns |
|---|---|
| `MultisetNavigation.ts` | The Inspector surface, Unity event wiring, and the public methods a Button can call |
| `NavigationVisuals.ts` | **How navigation looks** — the scrolling-arrow shader, the path mesh, POI labels, the navmesh debug overlay |
| `NavigationPanel.ts` | The destination picker, progress HUD and toasts. Plain DOM, no framework |
| `MapPOI.ts` | One navigable destination |
| `MapPOIType.ts` | The POI kind dropdown (paired with `Assets/MapPOIType.cs`) |
| `VPSSettings.ts` | The runtime settings panel's component: finds `MultisetVPS` and applies panel changes through the SDK setters |
| `VPSSettingsPanel.ts` | The panel itself. Plain DOM, no SDK or Needle import, so you can restyle or replace it freely |

### SDK templates — sync, don't diverge

`MultisetVPS.ts`, `MapSpace.ts`, `MapAnchor.ts` and `MapType.ts` ship with `@multisetai/vps`. They
are checked in so this sample is clone-and-run, which means they can fall behind the package. See
[Updating the SDK](#updating-the-sdk).

## Inspector reference

### `Multiset Navigation`

| Field | Default | What it does |
|---|---|---|
| **Nav Mesh** | — | The walkable surface. **Required.** |
| **Show Nav Mesh Debug** | off | Green overlay of the walkable surface. Leave on while setting up |
| **Arrow Texture** | — | Tiled along the path. Empty gives a plain glowing strip |
| **Path Color** | cyan | |
| **Path Width** | `0.35` | Ribbon width in metres |
| **Path Height Above Floor** | `0.1` | Raise if the ribbon flickers against the floor |
| **Path Corner Radius** | `0.4` | Rounds off corners. `0` gives sharp corners, which makes arrows look bent at turns |
| **Arrow Spacing** | `2` | Metres from the start of one arrow to the next — the repeat period. Controls the **gap**, not the arrow's size |
| **Arrow Length** | `0` | Metres one arrow occupies. `0` = match Path Width, which keeps a square texture undistorted |
| **Arrow Scroll Speed** | `1` | Metres/sec. Negative reverses |
| **Show POILabels** | on | Floating name labels. (Unity's label nicifier does not split consecutive capitals, hence the run-together spelling) |
| **Poi Label Max Distance** | `40` | Hide labels beyond this. `0` shows all |
| **Use Default UI** | on | Mount `NavigationPanel`. Off = drive it from events yourself |
| **Recalc Interval Ms** | `500` | How often the route is recomputed. Fires regardless of movement |
| **Repath Move Threshold** | `0.5` | Metres of movement that force an *extra* immediate recalculation |
| **Invalid Path Grace Seconds** | `10` | How long off the walkable surface before giving up |
| **Arrival Radius** | `1.5` | Metres that count as arrival, measured **horizontally** |
| **Nav Mesh Snap Distance** | `4` | How far to look for ground under the viewer. Also separates floors |
| **On Navigation Started / Stopped / Arrived** | — | UnityEvents — wire them to anything in the scene |

The tuning defaults come from MultiSet's Unity navigation implementation, where they were tuned in
the field. Two are less obvious than they look: the interval fires **regardless of movement**,
because recalculating only while moving cannot notice a route breaking while the user stands still.
And arrival is **horizontal**, because a 3D distance includes eye height — a POI at floor level sits
~1.6 m below the camera, so a 1.5 m radius would be unreachable from any standing position.

**About the arrow texture.** Arrow art is conventionally a silhouette in the **alpha channel** with
flat RGB, so `NavigationVisuals.ts` treats the texture as a mask and takes the colour from
**Path Color**. That means a black-RGB PNG works fine and tints correctly. It also means the
texture's own colours are ignored — change the mask line in `NavigationVisuals.ts` if you want them.

The arrow's aspect ratio comes from **Arrow Length** ÷ **Path Width**, so at the default (`0` =
match width) a square texture is undistorted. For non-square art, set Arrow Length to
`pathWidth × (textureWidth / textureHeight)`.

### `MultisetVPS`

Sign-in fields are covered in [3. Add your credentials](#3-add-your-credentials). The rest, with
`0` or empty meaning the SDK or server default:

| Field | Default | What it does |
|---|---|---|
| **Map Type** | `SingleMap` | `SingleMap`, `MapSet` or `ObjectTracking` |
| **Show Mesh** | on | The purple + yellow-grid overlay of the scanned map. Turn **off** for production |
| **Occlusion** | off | Render the map mesh as an invisible occluder, so real walls hide content behind them. Takes precedence over Show Mesh |
| **Use Active Map Version** | off | For a versioned map, load the newest active scan's mesh (beta) |
| **Show Gizmo** | on | Axis marker at the map origin |
| **Auto Localize** | on | Localize once when the AR session starts |
| **Relocalization** | off | Localize again after tracking is lost, the app is switched away from, or the session resets |
| **Background Localization** / **Interval** | off / `30` s | Keep localizing on a timer (10–180 s) |
| **Confidence Check** / **Threshold** | off / `0.5` | Reject poses below the threshold (0.2–0.8) |
| **Deep Search** | off | Use the VPS-2 engine for every query: up to 15% higher recall, about 2 s per query |
| **Search Depth** | `0` | How far the search reaches inside the map, 1–5. Raise only for large maps that return no pose |
| **Query Mode Fallback** | off | Retry a missed VPS-1 query once with VPS-2, on the same frame |
| **Use Last Pose As Hint** | off | After a fix, send the device position as the hint for later queries |
| **First Localization Until Success** | off | Retry a failed first localization (up to 5 times) before reporting it |
| **Multi Frame** / **Count** / **Interval Ms** | off / `4` / `500` | Capture 4–6 frames and query them together: more robust, slower |
| **Hint Position** / **Hint Radius** | — / `25` | Narrow the search to a radius (5–100 m) around `x,y,z` |
| **Hint Map Codes** | — | Map sets only: restrict the search to these maps |
| **Convert To Geo Coordinates**, **Pass Geo Pose**, **Use 2D Filtering** | off | Geo-referenced maps only |

Each one is explained in the
[Localization Options](https://docs.multiset.ai/web-sdk/webxr-sdk/features/localization-options) guide.

### `VPSSettings`

| Field | Default | What it does |
|---|---|---|
| **Show Panel** | off | Show the runtime settings panel. This sample turns it on |
| **Start Collapsed** | on | Start as a gear button instead of the open panel |
| **Align Left** | off | Pin the panel to the top-left corner instead of the top-right |

### `MapPOI`

| Field | Default | What it does |
|---|---|---|
| **Poi Name** | — | The label users see |
| **Poi Id** | — | Stable id for `setDestination('id')`. Empty = GameObject name |
| **Poi Type** | `Room` | Kind of place. Purely descriptive — use it to pick an icon |
| **Arrival Radius** | `0` | Per-POI override. `0` = use the global value |
| **Description** | — | Free text for your own UI |

## Runtime settings panel

`VPSSettings` puts a gear button over the AR view. The panel changes localization options during
a session, so you can compare them on site without re-exporting from Unity:

| Section | Controls |
|---|---|
| **Display** | Occlusion, Show mesh |
| **Search** | Deep search (VPS-2), Search depth, Fall back to VPS-2 |
| **Hints** | Use last pose as hint, Clear hints |
| **Capture** | Multi-frame |

**Localize now** runs a localization with the current settings, and the panel shows what the last
query did. Settings the SDK reads only at startup are listed read-only under **Set in the
Inspector**.

Panel changes last for the page load only. They are never written back to the Inspector or the
scene, so the Inspector values stay the starting point.

To ship without the panel, untick **Show Panel**. Adding `?vpssettings` to the page URL still
shows it in any build, which is handy for testing a deployed app.

---

# Part 3 — Customising

## Wire Unity buttons

`MultisetNavigation`'s public methods appear in a Button's **On Click** dropdown:

| Method | Does |
|---|---|
| `showDestinations()` | Open the picker |
| `hideDestinations()` | Close the picker |
| `stopNavigation()` | Stop and clear the path |
| `navigateToNearest()` | Route to the closest reachable POI |
| `toggleNavMeshDebug()` | Toggle the walkable-surface overlay |

For the reverse direction, use the **On Navigation Started / Stopped / Arrived** UnityEvents.

> **The UI is HTML, not a Unity Canvas.** The SDK owns the WebXR session, so Needle's UI raycaster
> never activates, and in `immersive-ar` the WebGL canvas receives no pointer events. The session
> requests `dom-overlay`, which *does* receive taps. A world-space Canvas still renders fine for
> signage — it just cannot be tapped during a session.

## Change how it looks

| Want to change | Where |
|---|---|
| Path colour, width, arrow texture, speed | Inspector fields |
| Arrows look **stretched** | Lower **Arrow Length**, or leave it at `0` so it matches Path Width. Do *not* use Arrow Spacing for this — it only sets the gap |
| Arrows look **bent at turns** | Raise **Path Corner Radius** toward `0.6`–`0.8`, or raise `cornerSegments` in `NavigationVisuals.ts` for a smoother arc |
| Arrows come out **black** | The texture is being read as an alpha mask, which is the convention. If you supply art with meaningful RGB, change the mask line in `NavigationVisuals.ts` |
| How the path is drawn at all | `NavigationVisuals.ts` → `PathView`, `createPathArrowMaterial` |
| POI label design — icons per type, thumbnails, prefabs | `NavigationVisuals.ts` → `LabelsView` |
| The destination panel and HUD | `NavigationPanel.ts` |
| Replace the UI entirely | Untick **Use Default UI** and see [Build your own UI](#build-your-own-ui) |

The path mesh uses `buildPathRibbon` from the SDK, whose vertex contract is stable API: **`uv.x` =
distance along the path in metres** (not normalised), **`uv.y` = 0…1 across the width**. Any shader
honouring that will work.

## Customize the AR and capture buttons

Those buttons are **not** from the SDK. `MultisetVPS` passes `useDefaultButton: false` and builds its
own in `_createUI()`, so everything on screen lives in `MultisetVPS.ts`:

| Button | Appears when | Does |
|---|---|---|
| `START AR` / `STOP AR` | always | Toggles the XR session. Label swapped in `_onSessionStart()` / `_onSessionEnd()` |
| `CAPTURE FRAME` | Map Type is `SingleMap` or `MapSet` | Runs one localization. Reads `LOCALIZING...` and disables itself while in flight, then `_resetCaptureButton()` restores it |
| `TRACK OBJECT` | Map Type is `ObjectTracking` | Runs one detection pass |
| `CLEAR MESHES` | Map Type is `ObjectTracking` | Removes placed object meshes |

Edit `_createUI()` to change layout, styling, or which buttons exist. The `base` style string near the
top of that method is shared by all of them, so change it once to restyle the whole set.

The navigation UI is separate: the destinations button and HUD come from `NavigationPanel.ts`, not
from here. See [Build your own UI](#build-your-own-ui).

> ⚠️ `startSession()` must be the **first** call in a click handler. Any `await` before it consumes
> the browser's user activation token and the session request is rejected. There is a comment above
> `_createUI()` saying the same thing, because it is easy to break by adding a permission check or a
> fetch first.

> `MultisetVPS.ts` is one of the SDK template files. If you upgrade `@multisetai/vps` and refresh the
> templates, your `_createUI()` edits are in the file being replaced, so merge rather than overwrite.
> See [Updating the SDK](#updating-the-sdk).

## Build your own UI

The 3D visuals and the UI are separate, so you can replace one and keep the other.

**To restyle the existing panel**, edit `NavigationPanel.ts`. It is plain DOM with no framework: a
destination list, a progress HUD, and toasts, driven entirely by `Navigation` events.

**To replace it completely**, untick **Use Default UI** on `Multiset Navigation`. The path, arrows,
and POI labels keep working; nothing DOM is created. Then build your own against the component's
`navigation` property:

```ts
const nav = myNavigationComponent.navigation;   // null until setup completes

// Sort destinations by walking distance. distanceTo() is cached and throttled
// internally, so polling every POI on a timer is inexpensive.
const sorted = [...nav.pois]
  .map(poi => ({ poi, distance: nav.distanceTo(poi) }))
  .filter(e => e.distance >= 0)        // -1 means unreachable, or not known yet
  .sort((a, b) => a.distance - b.distance);

nav.setDestination(sorted[0].poi);

nav.on('pathUpdated', ({ remainingDistance }) => updateHud(remainingDistance));
nav.on('arrived', poi => toast(`Arrived at ${poi.name}`));
nav.on('unreachable', poi => toast(`No route to ${poi.name}`));
```

**Mount it in the WebXR DOM overlay**, not the page body. In `immersive-ar` the WebGL canvas
receives no pointer events, so UI appended anywhere else renders but never responds to taps:

```ts
const root = adapter.getSession().getOverlayRoot() ?? document.body;
```

`NavigationPanel.ts` does exactly this, so read it as the reference. The
[navigation guide](https://docs.multiset.ai/multiset/webxr-sdk/navigation#building-your-own-ui) covers
the event ordering worth knowing about, in particular how to baseline a progress bar so it does not
jump backwards when a route is recalculated.

## Drive it from code

```ts
const nav = myNavigationComponent.navigation;   // null until setup completes

nav.setDestination('kitchen');
nav.on('arrived', poi => console.log('arrived at', poi.name));
nav.on('tick', () => {
  const d = nav.distanceTo(nav.getPOI('kitchen'));   // cached, safe per frame
  if (d >= 0 && d < 3) playAudioGuide();
});
console.log(nav.diagnose());   // why navigation is not working, in one word
```

Full API: [navigation guide](https://docs.multiset.ai/multiset/webxr-sdk/navigation).

---

# Troubleshooting

**Start with `navigation.diagnose()`** — it names the blocker in one word. In the browser console,
if you exposed the component, or call it from your own code.

### Codegen didn't run, or components don't appear

Needle generates `Assets/Needle/Components.codegen/*.cs` by watching `src/scripts/`. If those files
are missing:

- Check the Unity Console for C# compile errors. `Assets/MapType.cs` and `Assets/MapPOIType.cs` must
  both be present — the generated stubs reference those enums, and without them nothing compiles
- Make sure the Needle Engine package is installed and `Needle Engine` exists in the scene
- Try Assets → **Reimport All**

### "Unknown components in scene", or the page loads with failed imports

Almost always a stale Vite cache: `npm install` rewrote `node_modules` while the dev server was
running. Stop it and restart with `--force`:

```bash
cd Needle/WebScene
npx vite --host --force
```

**Any time you run `npm install`, restart Vite with `--force` before testing.** Plain restart is not
always enough — `--force` is what discards `node_modules/.vite`.

### The navmesh GLB will not load

The tool's GLB export is unreliable. Test the file in an online glTF viewer such as
[gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/); if it fails there, it will fail in
Unity too.

Fix: export **GLTF** from the tool instead, drag it into the [three.js editor](https://threejs.org/editor/),
then **File → Export GLB**. That round trip only re-serialises the file — geometry and coordinates
are untouched.

### The recast tool exports an empty file

A file of only a few bytes — often literally `{}` — means there was no navmesh to export.

- Click **Generate NavMesh** *before* **Export as GLB** — export writes the last generated result
- Use the **raw** map mesh, not the textured one
- Load the tool's own sample model. If that works and your map does not, the mesh is the problem —
  most likely **inverted normals**, since recast only treats upward-facing triangles as walkable
- Try Cell Size `0.3`, Slope `60`, Walkable Radius `1`

### `Nav Mesh is not assigned`

Drag the navmesh **from the Hierarchy**, not the Project window — the field takes a `Transform`
reference to a scene object.

### `No MapPOI components found`

Add `MapPOI` to some GameObjects under `Map Space` and fill in **Poi Name**.

### Content appears in the wrong place

Tick **Show Mesh** on `MultisetVPS` and compare:

| What you see | Meaning |
|---|---|
| SDK map mesh matches the room, your content does not | `Map Space` or `navmesh` has a stray Transform. Both must be at identity |
| Both are wrong | A localization problem, not a navigation one. Try a more feature-rich part of the space |
| They do not overlap each other | Your navmesh came from a different source than the map you are localizing against |

### Every destination says "no route"

Turn on **Show Nav Mesh Debug** — the green overlay shows exactly what is walkable.

- **Are you standing on it?** You must be within `Nav Mesh Snap Distance` (4 m) of the surface
- **Is the green plane at the right height?** If it floats at knee height or sinks below the floor,
  the map origin is not where you assumed
- **Console warning about `N disconnected regions`?** Expected across floors. Otherwise the navmesh
  is torn, and the usual cause is a **T-junction** — a vertex touching another triangle's edge
  without being shared with it. Two triangles need two *shared* vertices to count as neighbours, so
  the surface looks solid and is not. Regenerate with a larger Cell Size

### One destination says "no route", the others work

It is more than 1 m **horizontally** outside the walkable area. Height is forgiven; sideways
placement is not. Move it over the green surface.

### The route disappears while I walk

Fixed in the SDK, but if you see it: the route now enters a 10-second grace period and recovers by
itself rather than cancelling. Persistent flicker means the navmesh is fragmented — regenerate with
a larger Cell Size and `Min Region Area` around `2`.

### Labels or the path never appear, even after localizing

They are children of `Map Space`, which stays hidden until the first localization succeeds. If
localization succeeded and they are still missing, check the console for `[MultisetNavigation]`
errors.

### Black camera feed in AR

A Needle **`WebXR`** component is in the scene. Delete it — `MultisetVPS` owns the session.

### CORS errors on every request

Your origin is not whitelisted. Developer portal → **Credentials → Settings → Domains**. Add both
`https://localhost:3000` and your LAN address.

---

# Updating the SDK

```bash
cd Needle/WebScene
npm install @multisetai/vps@latest
npx vite --host --force          # discard the stale dep cache
```

The `--force` matters: `npm install` rewrites `node_modules` while Vite may still be serving a
pre-bundled copy of the old package, and a plain restart does not always discard it.

### The SDK-owned files

Five files in this project are **copies of SDK templates**, not sample code. Needle's Unity codegen
only scans your own project, so they have to exist as local files rather than package imports:

| File | Location |
|---|---|
| `MultisetVPS.ts` | `Needle/WebScene/src/scripts/` |
| `MapSpace.ts` | `Needle/WebScene/src/scripts/` |
| `MapAnchor.ts` | `Needle/WebScene/src/scripts/` |
| `MapType.ts` | `Needle/WebScene/src/scripts/` |
| `MapType.cs` | `Assets/` |

They are checked in so this sample is clone-and-run, which means they can fall behind the installed
package after an upgrade. The originals ship inside the package, so compare and refresh them from
there when you upgrade:

```bash
# from the repository root, after npm install
diff -r Needle/WebScene/node_modules/@multisetai/vps/templates Needle/WebScene/src/scripts
```

Copy over only what you need. If you have customised any of them, merge rather than overwrite: your
edits are yours, and nothing in this repository will replace them for you.

---

## Docs

- [Navigation guide](https://docs.multiset.ai/multiset/webxr-sdk/navigation)
- [WebXR SDK docs](https://docs.multiset.ai/multiset/webxr-sdk)
- [MapSpace reference](https://docs.multiset.ai/multiset/webxr-sdk/api-reference/mapspace)
- [SDK README and changelog](https://www.npmjs.com/package/@multisetai/vps)
- [Developer portal](https://developer.multiset.ai)
