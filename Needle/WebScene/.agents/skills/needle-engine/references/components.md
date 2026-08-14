# Needle Engine — Built-in Components Reference

## Table of Contents
- [Physics](#physics)
- [Animation](#animation)
- [Audio](#audio)
- [Video](#video)
- [Lighting and Shadows](#lighting-and-shadows)
- [Post-Processing](#post-processing)
- [Camera](#camera)
- [Scene Switching](#scene-switching)
- [Interaction](#interaction)
- [Splines](#splines)
- [Gaussian Splats](#gaussian-splats)
- [Debug Tools](#debug-tools)
- [Utilities](#utilities)

---

## Physics

See [physics.md](physics.md) for the full physics reference (colliders, Rigidbody API, raycasting, async loading).

Rapier initializes automatically — just add collider and rigidbody components. Use `SphereCollider` for balls, `CapsuleCollider` for characters/cylinders, not BoxCollider for everything. Use `applyImpulse` for one-shot actions, `applyForce` for continuous. Never access `rb._body` internals.

---

## Animation

### Animation (simple clip playback)
```ts
import { Animation } from "@needle-tools/engine";

const anim = this.gameObject.getComponent(Animation);
anim.play();                       // play default clip
anim.play("Idle");                 // play by clip name
anim.stop();
anim.loop = true;                  // loop playback (default: true)
anim.playAutomatically = true;     // auto-play on enable (default: true)
```

### Animator (state machine — Unity Animator Controller)
```ts
import { Animator } from "@needle-tools/engine";

const anim = this.gameObject.getComponent(Animator);

anim.play("Run");                  // play by state name
anim.setFloat("Speed", 1.5);      // Animator parameters (match Unity parameter names)
anim.setBool("IsGrounded", true);
anim.setTrigger("Jump");
anim.speed = 0.5;                  // global playback speed multiplier
```

### PlayableDirector (Timeline)
```ts
import { PlayableDirector } from "@needle-tools/engine";

const director = this.gameObject.getComponent(PlayableDirector);
director.play();                   // start playback
director.pause();
director.stop();
director.time = 2.5;              // scrub to time (seconds)
director.evaluate();              // evaluate at current time (use after setting time)
director.isPlaying                // check playback state
director.isPaused
director.duration                 // total duration in seconds
```

---

## Audio

### AudioSource
```ts
import { AudioSource } from "@needle-tools/engine";

const audio = this.gameObject.getComponent(AudioSource);
audio.clip = "sounds/music.mp3";  // URL to audio file
audio.volume = 0.8;
audio.loop = true;
audio.spatialBlend = 1;           // 0 = 2D, 1 = full 3D positional
audio.play();
audio.pause();
audio.stop();

// Browser autoplay policy: audio won't play until user interaction
AudioSource.registerWaitForAllowAudio(() => {
  audio.play();
});
```

Key properties: `clip` (string/MediaStream), `volume` (0–1), `loop`, `spatialBlend` (0–1), `playOnAwake`, `pitch`, `minDistance`, `maxDistance`, `isPlaying`, `time`, `duration`.

Supported formats include `.opus` (5.1+). There's also a standalone `AudioClip` class (5.1+) with its own playback control, for audio not tied to an `AudioSource` component.

### AudioListener
Represents the "ears" in the scene. Attach to the camera (auto-added to main camera if missing). Only one should be active.

```ts
import { AudioListener } from "@needle-tools/engine";
this.context.mainCamera?.addComponent(AudioListener);
```

---

## Video

### VideoPlayer
```ts
import { VideoPlayer } from "@needle-tools/engine";

const vp = this.gameObject.addComponent(VideoPlayer);
vp.url = "videos/intro.mp4";       // mp4, webm, or m3u8 (HLS)
vp.isLooping = true;
vp.playOnAwake = true;
vp.play();
vp.pause();
vp.stop();
vp.currentTime = 10;                // seek to 10 seconds

// Webcam / screen capture:
vp.setVideo(mediaStream);

// HLS livestreams: just set an m3u8 URL — hls.js loads automatically
vp.url = "https://stream.example.com/live.m3u8";
```

Key properties: `url`, `isLooping`, `playbackSpeed`, `muted`, `playInBackground`, `screenspace`, `isPlaying`, `videoElement`, `videoTexture`.

The video texture is applied to the object's material by default (MaterialOverride render mode). The object needs a `Renderer` component.

---

## Lighting and Shadows

### Light
```ts
import { Light } from "@needle-tools/engine";

const light = this.gameObject.getComponent(Light);
light.intensity = 1.5;
light.color.set(1, 0.95, 0.9);   // warm white
light.shadows = 2;                 // 0=None, 1=Hard, 2=Soft
light.shadowResolution = 2048;
```

Light types (set in Unity/Blender, not changeable at runtime): Directional (1), Point (2), Spot (0). Spot lights have `spotAngle` and `innerSpotAngle`. Point/Spot lights have `range`.

### ContactShadows
Soft ground shadows based on proximity — no lights needed.
```ts
import { ContactShadows } from "@needle-tools/engine";

// Auto-create fitted to scene
const shadows = ContactShadows.auto(this.context);
shadows.opacity = 0.6;
shadows.blur = 5;

// Or via HTML attribute:
// <needle-engine contactshadows="0.7">
```

### ShadowCatcher
Catches real-time shadows from light sources onto a surface. Use for AR ground planes.
```ts
import { ShadowCatcher } from "@needle-tools/engine";
const catcher = obj.addComponent(ShadowCatcher);
catcher.mode = 0;  // 0=ShadowMask, 1=Additive, 2=Occluder
```

ContactShadows = soft ambient-style, no lights needed, better performance. ShadowCatcher = accurate shadows from real lights, higher cost.

### ReflectionProbe
Provides per-object environment reflections using cubemap or HDR textures. Objects can reference a specific probe as their reflection source, producing more accurate localized reflections than a single global environment map.

```ts
import { ReflectionProbe } from "@needle-tools/engine";

// Typically set up in Unity/Blender: add ReflectionProbe to an object, assign a cubemap texture,
// then on Renderer components set the probe as "anchor override"

// Check if a material is using a reflection probe:
ReflectionProbe.isUsingReflectionProbe(material);
```

Debug: `?debugreflectionprobe` URL param. Disable all: `?noreflectionprobe`.

---

## Post-Processing

See [postprocessing.md](postprocessing.md) for the full post-processing reference (all effects, parameters, runtime changes).

Key points: Use `this.context.postprocessing.addEffect(effect)` / `.removeEffect(effect)`. Effects use `VolumeParameter` — set values with `.value`. Toggle with `effect.enabled`. Loads async via `NEEDLE_ENGINE_MODULES.POSTPROCESSING`.

---

## Camera

```ts
// Access the main camera
this.context.mainCamera                  // THREE.Camera
this.context.mainCameraComponent         // Needle Camera component

// Switch the active camera:
import { Camera } from "@needle-tools/engine";
const cam = targetObject.getComponent(Camera);
this.context.setCurrentCamera(cam);      // make this the active camera

// Camera properties
cam.fieldOfView = 60;
cam.nearClipPlane = 0.1;
cam.farClipPlane = 1000;
cam.orthographic = false;

// Screen to world
const ray = cam.screenPointToRay(screenX, screenY);
```

Key properties: `fieldOfView`, `nearClipPlane`, `farClipPlane`, `backgroundColor`, `orthographic`, `orthographicSize`, `clearFlags`, `targetTexture`.

### Custom camera control (first-person, etc.)
For code-only scenes where you want full camera control (first-person, fly cam, etc.):

1. Use `<needle-engine camera-controls="0">` to prevent auto-added OrbitControls
2. Remove any existing OrbitControls — they override camera rotation every frame:
```ts
import { OrbitControls } from "@needle-tools/engine";

onStart(ctx => {
  // Remove OrbitControls so they don't fight your custom camera logic
  const cam = ctx.mainCamera;
  const orbit = cam?.getComponent(OrbitControls);
  if (orbit) orbit.destroy();
});
```
3. Write a `Behaviour` component for camera control — use `update()` and the engine's input system (`this.context.input`), not raw DOM events or `requestAnimationFrame`
4. See the [FirstPersonCharacter sample](https://github.com/needle-tools/needle-engine-samples/blob/main/package/Runtime/FirstPersonController/Scripts/FirstPersonController~/FirstPersonCharacter.ts) for a working example

---

## Scene Switching

`SceneSwitcher` manages loading/unloading multiple GLB scenes — useful for multi-room apps, configurators, portfolios.

```ts
import { SceneSwitcher } from "@needle-tools/engine";

const switcher = this.gameObject.getComponent(SceneSwitcher);
await switcher.select(0);               // by index
await switcher.select("myScene");        // by name/URI
await switcher.selectNext();
await switcher.selectPrev();

// Add scenes dynamically
switcher.addScene("assets/room2.glb");

// Events
switcher.addEventListener("loadscene-finished", (e) => {
  console.log("Loaded:", e.detail.scene.url);
});
```

Key properties: `scenes` (AssetReference[]), `currentIndex`, `preloadNext`, `preloadPrevious`, `useHistory` (browser back/forward), `useKeyboard` (arrow keys), `useSwipe`, `queryParameterName` (URL param, default `"scene"`).

You can also implement scene switching yourself using `AssetReference` or `loadAsset()`:
```ts
import { AssetReference, loadAsset } from "@needle-tools/engine";

// With AssetReference (caches by URL):
const ref = AssetReference.getOrCreate(baseUrl, "assets/room2.glb");
const instance = await ref.instantiate({ parent: this.context.scene });

// With loadAsset (returns a model wrapper):
const model = await loadAsset("assets/room2.glb");
this.context.scene.add(model.scene);
```

---

## Interaction

### DragControls
Enables dragging objects in 3D. Automatically takes ownership in networked scenes.
```ts
import { DragControls, DragMode } from "@needle-tools/engine";
const drag = obj.addComponent(DragControls);
drag.dragMode = DragMode.XZPlane;       // horizontal plane
// Modes: XZPlane, Attached, HitNormal, DynamicViewAngle (default), SnapToSurfaces, None

drag.keepScale = true;                  // 5.1+ constraint system, two-touch scale min/max
```
As of 5.1, rotation is limited to two-touch and XR controller input — single-touch dragging is
translation-only and more predictable — plus a dedicated screen-space drag mode for AR.

### Duplicatable
Add alongside `DragControls` — dragging creates a clone instead of moving the original.
```ts
import { Duplicatable } from "@needle-tools/engine";
obj.addComponent(Duplicatable);
```

### DropListener
Enables drag-and-drop of files from the desktop into the 3D scene (GLB, FBX, OBJ, USDZ, VRM, images).
```ts
import { DropListener } from "@needle-tools/engine";
const dl = myObject.addComponent(DropListener);
dl.fitIntoVolume = true;     // auto-scale dropped objects
dl.useNetworking = true;     // sync drops to other clients

// Or load programmatically:
const loaded = await dl.loadFromURL("https://example.com/model.glb");
```

### CharacterController
Capsule collider + rigidbody for character movement. Auto-creates physics components on enable.
```ts
import { CharacterController } from "@needle-tools/engine";

const cc = this.gameObject.getComponent(CharacterController);
cc.move(new Vector3(0, 0, 0.1));  // move forward
cc.isGrounded;                     // true when touching ground

// For jumping, use the rigidbody directly:
if (cc.isGrounded) cc.rigidbody.applyImpulse(new Vector3(0, 5, 0));
```

`CharacterControllerInput` provides a ready-made WASD + Space control scheme with double-jump and animator integration.

For a full first-person controller example, see the [FirstPersonCharacter sample](https://github.com/needle-tools/needle-engine-samples/blob/main/package/Runtime/FirstPersonController/Scripts/FirstPersonController~/FirstPersonCharacter.ts).

For clickable hotspot labels on 3D objects (common in product configurators), see the [Hotspot sample](https://github.com/needle-tools/needle-engine-samples/blob/main/package/Runtime/Hotspots/Scripts/Needle.Hotspots~/Hotspot.ts).

### needle-menu (built-in UI menu)
The `<needle-menu>` web component provides a built-in hamburger menu. Components like `SyncedRoom` and `Voip` add buttons to it automatically. Access via `this.context.menu`.

```ts
// Add a button using ButtonInfo object (recommended)
this.context.menu.appendChild({
  label: "My Action",
  icon: "settings",            // Google Material Icons name
  onClick: () => { /* ... */ },
  priority: 50,                // higher = further right, always visible
});

// Or add a raw HTML button
const button = document.createElement("button");
button.textContent = "Click me";
button.onclick = () => { /* ... */ };
this.context.menu.appendChild(button);

// Control visibility (hiding requires Needle Engine PRO license in production)
this.context.menu.setVisible(false);

// Hide the Needle logo (requires license)
this.context.menu.showNeedleLogo(false);

// Set button priority (controls ordering and which buttons stay visible when space is limited)
NeedleMenu.setElementPriority(button, 90);
```

---

## Splines

### SplineContainer
Defines curves/paths in the scene. Can be created in Unity/Blender or from code.
```ts
import { SplineContainer } from "@needle-tools/engine";
import { Vector3 } from "three";

const spline = obj.addComponent(SplineContainer);
spline.addKnot({ position: new Vector3(0, 0, 0) })
      .addKnot({ position: new Vector3(5, 2, 5) })
      .addKnot({ position: new Vector3(10, 0, 0) });
spline.closed = false;

// Sample the spline (t: 0–1)
const point = spline.getPointAt(0.5);      // world-space position
const tangent = spline.getTangentAt(0.5);  // world-space tangent
```

### SplineWalker
Moves an object along a spline path.
```ts
import { SplineWalker } from "@needle-tools/engine";
const walker = obj.addComponent(SplineWalker);
walker.spline = splineContainer;
walker.duration = 5;        // seconds for full traversal
walker.autoRun = true;
walker.useLookAt = true;    // face movement direction
```

---

## Gaussian Splats

### GaussianSplat *(6.0-alpha, experimental)*
Renders 3D Gaussian splats via Spark, with LOD, correct bounds, and raycasting.
```ts
import { GaussianSplat } from "@needle-tools/engine";
const splat = obj.addComponent(GaussianSplat);
splat.url = "assets/scan.spz";   // reassigning at runtime reloads the splat
splat.opacity = 1;               // 0–1
splat.raycastable = true;
splat.quality = "auto";          // "auto" | "high" | "medium" | "low"
```
Formats: `.ply`, `.spz`, `.splat`, `.sog`, `.rad` (`.rad` is chunked/seekable → streams progressively).

`quality: "auto"` resolves per device (mobile → low) and adapts at runtime — LOD density degrades
while frame rate is below target, and any step that doesn't measurably help is reverted. Sort
throttling and LOD density apply to the scene's *shared* splat renderer, so with multiple
GaussianSplat components the last applied quality wins for those. Debug with `?debugsplats`.

---

## Debug Tools

### Gizmos
Static methods for runtime debug drawing — shapes auto-remove after a duration (0 = one frame).
```ts
import { Gizmos } from "@needle-tools/engine";

Gizmos.DrawLine(start, end, color, duration, depthTest);
Gizmos.DrawWireSphere(center, radius, color, duration);
Gizmos.DrawRay(origin, direction, color, duration);
Gizmos.DrawLabel(position, text, size, duration);
Gizmos.DrawArrow(start, end, color, duration);
Gizmos.DrawWireBox(center, size, color, duration);
```

---

## Utilities

### EventList (Unity Events)
`EventList` is how Unity Events are serialized and invoked at runtime. Declare with `@serializable(EventList)` and call `.invoke()`.
```ts
import { EventList, serializable } from "@needle-tools/engine";

@serializable(EventList) onClick?: EventList;

// Invoke from code:
this.onClick?.invoke();

// Subscribe from code:
const unsub = this.onClick?.addEventListener(() => console.log("Clicked!"));
unsub();  // unsubscribe
```

### Creating Objects from Code
`ObjectUtils` provides convenience methods for creating primitives and text. These are helpers — you can always use standard Three.js objects directly (`new Mesh(geometry, material)`).
```ts
import { ObjectUtils, PrimitiveType } from "@needle-tools/engine";

const cube = ObjectUtils.createPrimitive(PrimitiveType.Cube, {
  color: 0xff0000,
  parent: this.gameObject,
  position: { x: 0, y: 1, z: 0 }
});

const text = ObjectUtils.createText("Hello World");
this.context.scene.add(text);
```

Available primitives: `Cube`, `Sphere`, `Quad`, `Cylinder`. For anything more complex, use Three.js geometry directly or load GLB models.

### ParticleSystem
Full particle system with emission, shape, velocity, color/size over lifetime modules. Currently best configured via Unity/Blender — difficult to set up from code only.
```ts
import { ParticleSystem } from "@needle-tools/engine";
const ps = this.gameObject.getComponent(ParticleSystem);
ps.play();
ps.stop();
ps.pause();
```
