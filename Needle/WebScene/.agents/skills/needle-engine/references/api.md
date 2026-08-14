# Needle Engine — Core API Reference

## Table of Contents
- [Lifecycle Methods](#lifecycle-methods-complete)
- [Decorators](#decorators)
- [Context API](#context-api-thiscontext)
- [GameObject Utilities](#gameobject-utilities)
- [Finding Objects](#finding-objects)
- [Coroutines](#coroutines)
- [Asset Loading at Runtime](#asset-loading-at-runtime)
- [Renderer and Materials](#renderer-and-materials)
- [Object3D Extensions](#object3d-extensions)
- [Utilities](#utilities)
- [Vite Plugin Options](#vite-plugin-options)

---

## Lifecycle Methods (complete)

All methods are optional — only implement what you need.

```ts
class MyComponent extends Behaviour {
  // Initialization
  awake()        // first, before Start, even if disabled
  onEnable()     // whenever component/GO becomes active
  start()        // once, on first enabled frame

  // Per-frame
  earlyUpdate()  // every frame, before update()
  update()       // every frame
  lateUpdate()   // every frame, after all update() runs
  onBeforeRender(frame: XRFrame | null)  // just before Three.js renders
  onAfterRender()                        // just after Three.js renders

  // Deactivation / cleanup
  onDisable()    // when component/GO becomes inactive
  onDestroy()    // called by destroy(obj) — NOT by removeComponent()
  // autoCleanup(disposable) — 5.1+, register teardown against the lifecycle.
  // Scope depends on WHERE you call it: onEnable → disable; awake/start → destroy.

  // Pointer events — raycast visible mesh geometry (no Collider needed).
  // The EventSystem + ObjectRaycaster are auto-created; no manual setup.
  onPointerEnter?(args: PointerEventData)   // pointer enters this object
  onPointerMove?(args: PointerEventData)    // pointer moves over this object
  onPointerExit?(args: PointerEventData)    // pointer leaves this object
  onPointerDown?(args: PointerEventData)    // pointer button pressed on this object
  onPointerUp?(args: PointerEventData)      // pointer button released
  onPointerClick?(args: PointerEventData)   // full click on this object

  // XR events
  supportsXR?(mode: XRSessionMode): boolean            // filter which XR modes this component handles
  onBeforeXR?(mode: XRSessionMode, args: XRSessionInit) // modify session init params
  onEnterXR?(args: NeedleXREventArgs)                  // joined an XR session
  onUpdateXR?(args: NeedleXREventArgs)                 // per-frame during XR
  onLeaveXR?(args: NeedleXREventArgs)                  // left the XR session
  onXRControllerAdded?(args: NeedleXRControllerEventArgs)   // controller connected
  onXRControllerRemoved?(args: NeedleXRControllerEventArgs) // controller disconnected

  // Physics (requires Needle Collider component on same GameObject)
  onCollisionEnter(col: Collision)
  onCollisionStay(col: Collision)
  onCollisionExit(col: Collision)
  onTriggerEnter(col: Collision)
  onTriggerStay(col: Collision)
  onTriggerExit(col: Collision)
}
```

---

## Decorators

| Decorator | Purpose |
|---|---|
| `@registerType` | Required on every component — registers the class for GLB deserialization |
| `@serializable()` | Serialize/deserialize a primitive (number, string, boolean) |
| `@serializable(Type)` | Serialize/deserialize a typed field (Object3D, Texture, Color, etc.) |
| `@syncField()` | Auto-sync field over the network in a SyncedRoom |
| `@syncField(onChange)` | Sync + call a callback when value changes remotely |


### Serializable Types

```ts
// Primitives — no type argument needed
@serializable() myNumber!: number;
@serializable() myString!: string;
@serializable() myBool!: boolean;

// Complex types — pass the constructor
import { RGBAColor, AssetReference } from "@needle-tools/engine";
import { Object3D, Texture, Vector2, Vector3, Color } from "three";

@serializable(Object3D)      myRef!: Object3D;
@serializable(Texture)       tex!: Texture;
@serializable(RGBAColor)     col!: RGBAColor;
@serializable(AssetReference) asset!: AssetReference;
@serializable(Vector3)       pos!: Vector3;
```

---

## Context API (`this.context`)

```ts
this.context.scene          // THREE.Scene
this.context.mainCamera     // THREE.Camera (currently active)
this.context.renderer       // THREE.WebGLRenderer
this.context.domElement     // <needle-engine> HTML element

// Lighting (5.1+)
this.context.lights         // ILight[] — all registered lights
this.context.mainLight      // brightest directional light, or null

// Scene Bindings (5.1+, experimental) — see whats-new.md
this.context.sceneData      // typed node/component access; components need .$components

// Typed event bus (5.1+) — on() returns an unsubscribe function
this.context.events.on("scene-content-changed", e => e.object);
this.context.events.emit<{ pts: number }>("scored", { pts: 10 });

// Time
this.context.time.frame       // frame counter (number)
this.context.time.deltaTime   // seconds since last frame (affected by timeScale)
this.context.time.time        // total elapsed seconds
this.context.time.realtimeSinceStartup
this.context.time.timeScale   // default 1; affects deltaTime, animation, and audio

// Input — polling API (check in update())
this.context.input.getPointerDown(index)     // pointer just pressed this frame
this.context.input.getPointerUp(index)       // pointer just released this frame
this.context.input.getPointerPressed(index)  // pointer currently held
this.context.input.getPointerPosition(index) // {x, y} in screen pixels
this.context.input.getPointerPositionDelta(index)  // movement since last frame
this.context.input.getPointerPressedCount()  // how many pointers are pressed
this.context.input.mousePosition             // shortcut for pointer 0 position
this.context.input.getKeyDown(key)           // "Space", "ArrowLeft", "a", etc.
this.context.input.getKeyUp(key)
this.context.input.getKeyPressed(key)

// Input — event-based API (subscribe/unsubscribe)
this.context.input.addEventListener("pointerdown", (evt) => { /* NEPointerEvent */ });
this.context.input.addEventListener("pointerup", callback);
this.context.input.addEventListener("pointermove", callback);
this.context.input.addEventListener("keydown", callback);
this.context.input.removeEventListener("pointerdown", callback);

// Component pointer callbacks (EventSystem + ObjectRaycaster are auto-created — no manual setup;
// they raycast visible mesh geometry, so no Collider is needed):
// onPointerEnter, onPointerMove, onPointerExit, onPointerDown, onPointerUp, onPointerClick
// These fire on the specific object the pointer interacts with (see Lifecycle Methods)

// Physics — two raycast systems for different purposes:
// 1. Visual raycast: hits rendered geometry (no collider needed)
//    Automatically builds MeshBVH (three-mesh-bvh) on web workers — falls back to standard
//    three.js raycasting until BVH is ready. Works with procedural geometry too.
//    Use for: UI interaction, picking visible objects, click detection

// Simplest usage — uses current pointer position, works in pointer event handlers:
const hits = this.context.physics.raycast();

// With options:
this.context.physics.raycast({ maxDistance: 100, layerMask: 0xff, ignore: [this.gameObject] })

// From a specific pixel position (e.g. in a raw pointerdown handler):
// IMPORTANT: screenPoint is in normalized device coordinates (-1 to 1), NOT pixels!
const hits = this.context.physics.raycast({
  screenPoint: new Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  ),
});

// DO NOT pass raw pixel coords as screenPoint — this is wrong:
// ctx.physics.raycast({ screenPoint: new Vector2(e.clientX, e.clientY) }) // WRONG!

// 2. Physics engine raycast: hits Rapier colliders only
//    Use for: ground detection, line-of-sight, physics-based queries
this.context.physics.engine?.raycast(origin, direction, { maxDistance, solid })
this.context.physics.engine?.raycastAndGetNormal(origin, direction)
this.context.physics.engine?.sphereOverlap(position, radius)

// Access Rapier world directly for advanced queries:
this.context.physics.engine.world            // underlying Rapier world

// Network
this.context.connection                      // core networking manager (usable directly or via SyncedRoom)
```

---

## GameObject Utilities

```ts
import { instantiate, destroy, GameObject } from "@needle-tools/engine";

// Component access
go.getComponent(Type)
go.getComponentInChildren(Type)
go.getComponentInParent(Type)
go.getComponents(Type)         // all matching on same GO
go.getComponentsInChildren(Type)

// Lifecycle
instantiate(source, opts?)              // preferred — clone; opts: { position, rotation, parent }
destroy(obj)                            // destroys GO + calls onDestroy on components
obj.removeComponent(comp)               // removes without calling onDestroy

// Active state
go.visible = false           // hides in scene (still ticks)
GameObject.setActive(go, false)  // disables lifecycle callbacks

// Hierarchy
go.contains(otherObj)        // true if otherObj is a descendant (Needle extension on Object3D)

// World-space properties (Needle extensions on Object3D)
go.worldPosition             // get/set world position (Vector3)
go.worldQuaternion           // get/set world rotation (Quaternion)
go.worldScale                // get/set world scale (Vector3)
go.worldForward              // forward direction in world space (Vector3)
go.worldRight                // right direction in world space (Vector3)
go.worldUp                   // up direction in world space (Vector3)

// Tag / name
go.name          // string
go.userData.tags // string[] (set from Unity via Tag component)
```

---

## Finding Objects

```ts
import { findObjectOfType, findObjectsOfType } from "@needle-tools/engine";

findObjectOfType(MyComponent, ctx)          // first match in scene
findObjectsOfType(MyComponent, ctx)         // all matches
ctx.scene.getObjectByName("Player")         // by name (Three.js built-in)
```

---

## Coroutines

Generator functions that can yield across frames:

```ts
import { WaitForSeconds, WaitForFrames, delayForFrames } from "@needle-tools/engine";

start() {
  this.startCoroutine(this.flashLight());
}

*flashLight() {
  while (true) {
    this.light.visible = !this.light.visible;
    yield WaitForSeconds(0.5);   // wait 0.5 seconds
    // yield;                    // wait exactly one frame
    // yield WaitForFrames(10);  // wait N frames
  }
}

// Stop all coroutines on this component:
this.stopAllCoroutines();

// Async alternative (returns a Promise):
await delayForFrames(5);
```

---

## Asset Loading at Runtime

```ts
import { AssetReference } from "@needle-tools/engine";

// Declare in component (set in Unity Inspector)
@serializable(AssetReference) prefab!: AssetReference;

async start() {
  // Load and instantiate
  const instance = await this.prefab.instantiate({ parent: this.gameObject });

  // Or just load the GLTF (no instantiate)
  const gltf = await this.prefab.loadAssetAsync();
}
```

Load a GLB by URL at runtime:
```ts
import { AssetReference } from "@needle-tools/engine";

const ref = AssetReference.getOrCreate(this.context.domElement.baseURI, "assets/extra.glb");
const instance = await ref.instantiate({ parent: this.gameObject });
```

Load any asset directly (without AssetReference):
```ts
import { loadAsset } from "@needle-tools/engine";

const model = await loadAsset("assets/model.glb");
const obj = model.scene; // ← Object3D is on .scene, not the return value itself
obj.traverse(n => { /* ... */ });
```

> **`loadAsset()` returns a model wrapper** (with `.scene`, `.animations`, etc.) — not an Object3D directly. The wrapper type is universal regardless of format (GLB, FBX, OBJ, USDZ). Use `model.scene` to get the root Object3D.

> **Caching:** `AssetReference.getOrCreate()` caches by URL and returns the **same Object3D** on repeated calls. Adding a cached object to the scene again just moves it. Use `.instantiate()` for independent copies.

> **Note:** Needle Engine automatically handles KTX, Draco, and meshopt decompression — no loader setup needed.

---

## Renderer and Materials

### Accessing meshes and materials
The `Renderer` component wraps Three.js meshes/materials. It's present on objects exported from Unity/Blender, but not automatically created for code-only objects — add it manually with `addComponent(Renderer)`, or access materials directly via Three.js (`(obj as Mesh).material`).

```ts
import { Renderer } from "@needle-tools/engine";

const renderer = this.gameObject.getComponent(Renderer);

// Materials
renderer.sharedMaterial            // first material (read/write)
renderer.sharedMaterials           // all materials (array, index-assignable)
renderer.sharedMaterials[0] = mat; // replace a material by index

// Meshes
renderer.sharedMesh                // first Mesh/SkinnedMesh Object3D
renderer.sharedMeshes              // all mesh Object3Ds (for multi-material groups)

// GPU Instancing — draws identical meshes in a single draw call for performance
// In Unity/Blender: enable on the material or via the Needle UI on the object
// In code:
Renderer.setInstanced(obj, true);  // enable instancing (also creates Renderer if missing)

// Visibility (without affecting hierarchy or component state)
Renderer.setVisible(obj, false);
```

### MaterialPropertyBlock — per-object material overrides
Overrides material properties (color, texture, roughness, etc.) on a **per-object** basis without creating new material instances. Multiple objects can share the same material but look different. Overrides are applied in `onBeforeRender` and restored in `onAfterRender`.

```ts
import { MaterialPropertyBlock } from "@needle-tools/engine";
import { Color, Texture } from "three";

// Get or create a property block for an object (never use the constructor directly)
const block = MaterialPropertyBlock.get(myMesh);

// Override properties
block.setOverride("color", new Color(1, 0, 0));
block.setOverride("roughness", 0.2);
block.setOverride("map", myTexture);

// Override with UV transform (e.g. for lightmaps)
block.setOverride("lightMap", lightmapTex, {
  offset: new Vector2(0.5, 0.5),
  repeat: new Vector2(2, 2)
});

// Read back
const color = block.getOverride("color")?.value;

// Remove overrides
block.removeOveride("color");     // remove one
block.clearAllOverrides();         // remove all
block.dispose();                   // remove the entire property block

// Check if an object has overrides
MaterialPropertyBlock.hasOverrides(myMesh);
```

Overrides are registered on the **Object3D**, not on the material — if you swap the material, overrides still apply to the new one. Use `dispose()` or `clearAllOverrides()` to remove them.

Common use cases: per-object colors/tinting, lightmaps, reflection probes, see-through/x-ray effects.

---

## Object3D Extensions

Needle Engine patches Three.js `Object3D.prototype` with convenience properties. These work on **any** Object3D in the scene.

### World transforms (getter + setter)
```ts
// GET — returns a temporary Vector3/Quaternion (don't store references, copy if needed)
obj.worldPosition       // Vector3 — world-space position
obj.worldQuaternion     // Quaternion — world-space rotation
obj.worldRotation       // Vector3 — world-space euler (degrees)
obj.worldScale          // Vector3 — world-space scale

// SET — must assign to apply (mutating the returned vector won't update the transform)
obj.worldPosition = new Vector3(1, 2, 3);     // sets world position
obj.worldQuaternion = myQuat;                  // sets world rotation
obj.worldScale = new Vector3(2, 2, 2);         // sets world scale

// Direction vectors (read-only)
obj.worldForward        // Vector3 — forward direction in world space (0,0,1 rotated)
obj.worldRight          // Vector3 — right direction
obj.worldUp             // Vector3 — up direction

// worldForward also has a setter — point an object in a direction:
obj.worldForward = targetDirection;
```

The getters return **temporary vectors** from an internal pool — they're overwritten on the next call. You can read and re-assign them directly (`obj.worldPosition = other.worldPosition`). For temporary math use `getTempVector()`. Only use `.clone()` when you must store a value across frames — never in per-frame code.

### Component access
```ts
obj.getComponent(MyComponent)           // first component of type
obj.getComponentInChildren(MyComponent) // search children recursively
obj.getComponentInParent(MyComponent)   // search parents recursively
obj.getComponents(MyComponent)          // all of type on this object
obj.getComponentsInChildren(MyComponent)
obj.addComponent(MyComponent)           // add a new component
```

### Other extensions
```ts
obj.guid                  // get/set — unique identifier for networking (string | undefined)
obj.contains(otherObj)    // true if otherObj is a descendant
obj.activeSelf            // get/set active state (same as GameObject.setActive)
```

`guid` is used by the networking system to identify objects across clients. Objects exported from Unity/Blender have guids automatically. For runtime-created objects, set `obj.guid = "my-id"` if they need to participate in networking (e.g. `syncInstantiate`, `SyncedTransform`).

### Bounding box and fitting
```ts
import { getBoundingBox, fitObjectIntoVolume } from "@needle-tools/engine";

// Get the bounding box of one or more objects
const box = getBoundingBox(myObject);                          // single object
const box = getBoundingBox([obj1, obj2, obj3]);                // multiple objects
const box = getBoundingBox(myObject, [ignoreThisChild]);       // with objects to ignore
const box = getBoundingBox(myObject, undefined, camera.layers); // filter by layer

const size = box.getSize(new Vector3());
const center = box.getCenter(new Vector3());

// Fit an object into a target volume (scale + position)
fitObjectIntoVolume(myObject, targetVolume);
```

---

## Async Modules (`NEEDLE_ENGINE_MODULES`)

Heavy dependencies (physics, postprocessing, etc.) are loaded on demand, not bundled into the main entry point. **You do NOT need to call these for normal usage** — physics and postprocessing initialize automatically when their components are used. These are for advanced use cases like accessing the raw Rapier API or pmndrs postprocessing module directly.

```ts
import { NEEDLE_ENGINE_MODULES } from "@needle-tools/engine";

// Available modules:
NEEDLE_ENGINE_MODULES.RAPIER_PHYSICS    // Rapier physics (WASM)
NEEDLE_ENGINE_MODULES.POSTPROCESSING    // pmndrs postprocessing
NEEDLE_ENGINE_MODULES.POSTPROCESSING_AO // N8AO ambient occlusion
NEEDLE_ENGINE_MODULES.MaterialX         // MaterialX materials (WASM)
NEEDLE_ENGINE_MODULES.PEERJS           // PeerJS for networking

// Each module has:
await module.load();    // trigger load + wait for it
await module.ready();   // wait for load (doesn't trigger one)
module.MODULE           // the loaded module (undefined until loaded)
module.MAYBEMODULE      // null until loaded, then same as MODULE
```

---

## Utilities

All imported from `@needle-tools/engine`.

### Math (`Mathf`)
```ts
import { Mathf } from "@needle-tools/engine";

Mathf.lerp(a, b, t)                    // linear interpolation
Mathf.clamp(value, min, max)            // clamp to range
Mathf.clamp01(value)                    // clamp to [0, 1]
Mathf.remap(value, inMin, inMax, outMin, outMax)  // remap between ranges
Mathf.moveTowards(current, target, step)           // step toward target
Mathf.inverseLerp(a, b, value)          // find t given value
Mathf.toDegrees(radians)
Mathf.toRadians(degrees)
Mathf.random(min, max)                  // random in range (or random from array)
Mathf.easeInOutCubic(t)                 // easing function
```

### Temporary objects (avoid per-frame allocations)
```ts
import { getTempVector, getTempQuaternion } from "@needle-tools/engine";

// Returns reusable objects from a circular buffer — no GC pressure
const v = getTempVector(1, 0, 0);       // temporary Vector3
const q = getTempQuaternion();           // temporary Quaternion
// Don't store references — they get reused. Clone if you need to keep them.
```

### Device detection (`DeviceUtilities`)
```ts
import { DeviceUtilities } from "@needle-tools/engine";

DeviceUtilities.isDesktop()         // Windows/Mac (not headsets)
DeviceUtilities.isMobileDevice()    // phone or tablet
DeviceUtilities.isiOS()             // iPhone, iPad, Vision Pro
DeviceUtilities.isAndroidDevice()
DeviceUtilities.isQuest()           // Meta Quest
DeviceUtilities.isVisionOS()        // Apple Vision Pro
DeviceUtilities.isSafari()
DeviceUtilities.supportsQuickLookAR()  // USDZ/QuickLook support
```

### Timing and delays
```ts
import { delay, delayForFrames, WaitForSeconds, WaitForFrames, WaitForPromise } from "@needle-tools/engine";

// Async
await delay(1000);                       // wait 1 second
await delayForFrames(5);                 // wait 5 frames

// In coroutines
yield WaitForSeconds(0.5);
yield WaitForFrames(10);
yield WaitForPromise(fetch("/api"));     // wait for a promise to resolve
```

### User interaction
```ts
import { awaitInputAsync } from "@needle-tools/engine";

// Wait for the first user interaction (useful for audio autoplay policy)
await awaitInputAsync();
audioSource.play();
```

### URL parameters
```ts
import { getParam, setParamWithoutReload } from "@needle-tools/engine";

const room = getParam("room");                    // read ?room=xyz from URL
setParamWithoutReload("room", "my-room");          // update URL without page reload
```

### Debug messages (on-screen balloon)
```ts
import { showBalloonMessage, showBalloonWarning, showBalloonError } from "@needle-tools/engine";

showBalloonMessage("Hello!");           // info message on screen
showBalloonWarning("Watch out!");       // warning (yellow)
showBalloonError("Something broke!");   // error (red)
```

### Debug console
Append `?console` to the URL to show an on-screen debug console (uses vConsole). Useful for debugging on mobile devices where dev tools aren't available.

### Screenshots
```ts
import { screenshot2, saveImage } from "@needle-tools/engine";

// Simple screenshot (returns data URL)
const dataUrl = screenshot2({ width: 1920, height: 1080 });
saveImage(dataUrl, "screenshot.png");

// Screenshot as texture (apply to a material)
const tex = screenshot2({ type: "texture", width: 512, height: 512 });

// Screenshot as blob
const blob = await screenshot2({ type: "blob" });

// Share via Web Share API
await screenshot2({ type: "share", title: "My Scene" });

// Transparent background
screenshot2({ transparent: true, trim: true });

// XR screenshot (composites 3D scene over camera feed — requires "camera-access" feature)
// Works in AR sessions when camera-access has been requested via onBeforeXR
const xrScreenshot = screenshot2({ width: 1080, height: 1920 });
```

### QR Code
```ts
import { generateQRCode } from "@needle-tools/engine";
const qr = generateQRCode({ text: "https://mysite.com" });
```

---

## Vite Plugin Options

The `needlePlugins` function accepts user settings as the third argument. These control build behavior, optimization, and features.

```ts
import { defineConfig } from "vite";
import { needlePlugins } from "@needle-tools/engine/vite";

export default defineConfig(async ({ command }) => ({
  plugins: [
    ...(await needlePlugins(command, {}, {
      // Key options:

      // Make all external CDN URLs local for offline/self-contained deployments
      makeFilesLocal: true,          // download everything
      // or: makeFilesLocal: "auto", // auto-detect which features to include
      // or: makeFilesLocal: { enabled: true, features: ["draco", "ktx2"] },

      // PWA support (also install vite-plugin-pwa)
      pwa: true,                     // enable with defaults
      // or: pwa: { /* VitePWAOptions */ },

      // Physics engine — set to false to tree-shake Rapier and reduce bundle size
      useRapier: false,

      // Build pipeline — compression and optimization of glTF files
      noBuildPipeline: false,        // default: runs optimization
      buildPipeline: {
        accessToken: process.env.NEEDLE_CLOUD_TOKEN,  // use Needle Cloud for compression
      },

      // Other options:
      // noAsap: true,              // disable glTF preload links
      // noPoster: true,            // disable poster image generation
      // openBrowser: true,         // auto-open browser on local network IP
    })),
  ],
}));
```

### `makeFilesLocal` features
Downloads external CDN URLs at build time for fully self-contained deployments. Available features: `draco`, `ktx2`, `materialx`, `xr`, `skybox`, `fonts`, `needle-fonts`, `needle-models`, `needle-avatars`, `polyhaven`, `cdn-scripts`, `github-content`, `threejs-models`, `needle-uploads`.

