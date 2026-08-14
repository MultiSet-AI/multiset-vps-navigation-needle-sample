# Needle Engine — WebXR Reference

## Table of Contents
- [Overview](#overview)
- [Starting XR Sessions](#starting-xr-sessions)
- [XRRig and Movement](#xrrig-and-movement)
- [Component XR Lifecycle](#component-xr-lifecycle)
- [NeedleXRController](#needlexrcontroller)
- [Pointer Events in XR](#pointer-events-in-xr)
- [XR + Networking (Avatars)](#xr--networking-avatars)
- [Image Tracking](#image-tracking)
- [Depth Sensing](#depth-sensing)
- [DOM Overlay (HTML in AR)](#dom-overlay-html-in-ar)
- [iOS AR (USDZ + App Clip)](#ios-ar-usdz--app-clip)

---

## Overview

Needle Engine supports WebXR for both VR and AR experiences. XR works across:
- **VR headsets** (Meta Quest, etc.) — `immersive-vr` mode
- **AR on Android** (Chrome) — `immersive-ar` mode via WebXR
- **AR on iOS** — via USDZ Quick Look export, or via the Needle App Clip (which provides real WebXR AR on iOS)

The `WebXR` component (added in Unity/Blender) handles the AR/VR buttons and session setup automatically. From code, use `NeedleXRSession.start()`.

---

## Starting XR Sessions

```ts
import { NeedleXRSession } from "@needle-tools/engine";

// Start VR
await NeedleXRSession.start("immersive-vr");

// Start AR via WebXR (Android, Quest, etc.)
await NeedleXRSession.start("immersive-ar");

// Shorthand "ar" — WebXR AR on supported devices, USDZ Quick Look on iOS
await NeedleXRSession.start("ar");

// With custom session init (e.g. request additional features)
await NeedleXRSession.start("immersive-ar", {
  optionalFeatures: ["camera-access", "plane-detection", "mesh-detection"]
});

// Check XR state anytime
this.context.xr?.isInXR       // boolean
this.context.xr?.session      // XRSession
this.context.xr?.mode         // "immersive-vr" | "immersive-ar"
this.context.xr?.controllers  // NeedleXRController[]
```

### Default features requested by Needle Engine

These are requested automatically — you don't need to add them:

**AR (`immersive-ar`):** `anchors`, `local-floor`, `layers`, `dom-overlay`, `hit-test`, `unbounded`, `hand-tracking` (except on visionOS)

**VR (`immersive-vr`):** `local-floor`, `bounded-floor`, `high-fixed-foveation-level`, `layers`, `hand-tracking` (except on visionOS)

WebXR anchors (`useAnchors`) are enabled by default as of 6.0-alpha.1.

Cap the XR frame rate with `context.xrFrameRateLimit` (6.0+) — applied through WebXR
`updateTargetFrameRate` where the device supports it. Useful for thermal headroom on phones;
the mobile splat preset uses it to hold AR at 30 fps.

**Not requested by default** — add these via `onBeforeXR` or the session init if you need them:
- `camera-access` — needed for AR screenshots/camera feed compositing (add `ARCameraBackground` component or request manually)
- `depth-sensing` — depth-based occlusion
- `plane-detection` — detect real-world planes
- `mesh-detection` — detect room mesh geometry
- `image-tracking` — track reference images (added automatically by `WebXRImageTracking` component)

```ts
// Add extra features via component lifecycle:
onBeforeXR(mode: XRSessionMode, init: XRSessionInit) {
  if (mode === "immersive-ar") {
    init.optionalFeatures ??= [];
    init.optionalFeatures.push("camera-access", "plane-detection");
  }
}

// Or via static event (global scope, outside components):
NeedleXRSession.onSessionRequestStart(evt => {
  evt.init.optionalFeatures?.push("mesh-detection");
});
```

---

## XRRig and Movement

The `XRRig` component defines the player's position and scale in XR. It's the parent transform for the headset and controllers — moving/rotating the XRRig moves the player in the scene. If no XRRig exists, one is created automatically.

```ts
import { XRRig } from "@needle-tools/engine";
// Add to an object in Unity/Blender, or create from code
// The rig's world position = the player's feet position
// The rig's scale controls the player's size relative to the scene
// In AR: a larger rig scale makes the scene appear smaller (you're "bigger" relative to it)
```

### XRControllerMovement
Built-in locomotion: thumbstick movement + snap/smooth turn + teleport.
```ts
import { XRControllerMovement } from "@needle-tools/engine";
// Add to an object in the scene — works automatically with XRRig
// movementSpeed: 1.5 (m/s), rotationType: snap or smooth, teleport: enabled by default
```

### TeleportTarget
Mark surfaces as valid teleport destinations.
```ts
import { TeleportTarget } from "@needle-tools/engine";
// Add to floor/ground objects — XRControllerMovement uses these as valid teleport targets
```

You can create custom XR movement by implementing `onUpdateXR` on your own component, or by extending the built-in XR components:

```ts
import { Behaviour, NeedleXREventArgs, NeedleXRController, registerType } from "@needle-tools/engine";
import { Vector3 } from "three";

@registerType
export class MyXRMovement extends Behaviour {
  speed = 2;

  onUpdateXR(args: NeedleXREventArgs) {
    const rig = args.xr.rig;
    if (!rig) return;

    // Move with left thumbstick
    for (const ctrl of args.xr.controllers) {
      const stick = ctrl.getStick("xr-standard-thumbstick");
      if (stick && (Math.abs(stick.x) > 0.1 || Math.abs(stick.y) > 0.1)) {
        // Get forward/right from the controller ray direction
        const forward = new Vector3(0, 0, -1).applyQuaternion(ctrl.rayWorldQuaternion);
        forward.y = 0;
        forward.normalize();
        const right = new Vector3(1, 0, 0).applyQuaternion(ctrl.rayWorldQuaternion);
        right.y = 0;
        right.normalize();

        const dt = this.context.time.deltaTime;
        rig.gameObject.position.add(forward.multiplyScalar(-stick.y * this.speed * dt));
        rig.gameObject.position.add(right.multiplyScalar(stick.x * this.speed * dt));
      }
    }
  }
}
```

---

## Component XR Lifecycle

Implement these optional methods on any component extending `Behaviour`:

```ts
import { Behaviour, NeedleXREventArgs, NeedleXRControllerEventArgs, registerType } from "@needle-tools/engine";

@registerType
export class MyXRComponent extends Behaviour {

  // Filter which XR modes this component handles
  supportsXR(mode: XRSessionMode): boolean { return true; }

  // Modify session init params before the session starts
  onBeforeXR(mode: XRSessionMode, args: XRSessionInit) {
    args.optionalFeatures?.push("hand-tracking");
  }

  onEnterXR(args: NeedleXREventArgs) {
    console.log("Entered XR, mode:", args.xr.mode);
    // args.xr is the NeedleXRSession
  }

  onUpdateXR(args: NeedleXREventArgs) {
    // Per-frame during XR — access controllers here
    for (const ctrl of args.xr.controllers) {
      const pos = ctrl.gripWorldPosition;
      const rot = ctrl.gripWorldQuaternion;
    }
  }

  onLeaveXR(args: NeedleXREventArgs) {
    console.log("Left XR");
  }

  onXRControllerAdded(args: NeedleXRControllerEventArgs) {
    console.log("Controller added:", args.controller.index, args.controller.isHand ? "hand" : "controller");
  }

  onXRControllerRemoved(args: NeedleXRControllerEventArgs) {
    console.log("Controller removed");
  }
}
```

---

## NeedleXRController

Wraps an `XRInputSource` — either a physical controller or a hand. Controller inputs are also emitted as pointer events, so `onPointerDown`/`onPointerClick` on components work with controllers too.

```ts
// Access in onUpdateXR or via context:
const controllers = this.context.xr?.controllers ?? [];

for (const ctrl of controllers) {
  // Identity
  ctrl.index                     // 0 = left, 1 = right (typically)
  ctrl.isHand                    // true if hand tracking, false if controller
  ctrl.hand                      // XRHand (if hand tracking)
  ctrl.profiles                  // input source profiles
  ctrl.connected                 // still connected?

  // Spatial data (rig space)
  ctrl.gripPosition              // Vector3 — grip position in rig space
  ctrl.gripQuaternion            // Quaternion — grip rotation in rig space
  ctrl.rayPosition               // Vector3 — ray origin in rig space
  ctrl.rayQuaternion             // Quaternion — ray direction in rig space

  // Spatial data (world space)
  ctrl.gripWorldPosition         // Vector3
  ctrl.gripWorldQuaternion       // Quaternion
  ctrl.rayWorldPosition          // Vector3
  ctrl.rayWorldQuaternion        // Quaternion

  // Buttons and sticks (named access)
  ctrl.getButton("trigger")      // { value, pressed, touched }
  ctrl.getButton("squeeze")
  ctrl.getButton("primary-button")   // A/X button
  ctrl.getStick("xr-standard-thumbstick")  // { x, y }

  // Raw gamepad
  ctrl.gamepad                   // Gamepad object

  // Hit testing
  ctrl.raycastHit                // current raycast result (if any)
}
```

---

## Pointer Events in XR

XR controllers and hands emit pointer events through the same system as mouse/touch. Your components' `onPointerDown`, `onPointerClick`, etc. work automatically with XR input.

### PointerEventData

The `PointerEventData` passed to pointer callbacks contains:

```ts
onPointerClick(args: PointerEventData) {
  // Source identification
  args.event                     // NEPointerEvent — the original event
  args.event.mode                // "screen" (mouse/touch), "tracked-pointer" (controller), "gaze", "transient-pointer" (hand)
  args.deviceIndex               // 0 for mouse/touch, controller index for XR
  args.pointerId                 // unique pointer+button combo ID
  args.button                    // 0=left, 1=middle, 2=right (mouse); button index (controller)
  args.buttonName                // "LeftButton", "trigger", "squeeze", etc.
  args.pressure                  // 0–1 pressure value

  // Hit information
  args.object                    // Object3D that was hit
  args.point                     // Vector3 — world position of the hit
  args.normal                    // Vector3 — surface normal at hit point
  args.distance                  // distance from origin to hit
  args.face                      // triangle face that was hit

  // State
  args.isDown                    // true on pointer down frame
  args.isUp                      // true on pointer up frame
  args.isPressed                 // true while held
  args.isClick                   // true on click
  args.isDoubleClick             // true on double click

  // Control
  args.use()                     // mark as consumed (other handlers won't receive it)
  args.used                      // true if already consumed
  args.setPointerCapture()       // receive move events even when pointer leaves this object
  args.releasePointerCapture()
  args.stopPropagation()         // stop event from reaching other handlers
}
```

**Screen coordinates:** `args.event.clientX` / `args.event.clientY` give the screen position of the pointer (for mouse/touch). For world-to-screen projection, use Three.js standard: `worldPos.clone().project(camera)` then convert to pixels.

Use `args.event.mode` to distinguish between mouse, touch, and XR controllers:
- `"screen"` — mouse or touch
- `"tracked-pointer"` — XR controller ray
- `"gaze"` — gaze-based input
- `"transient-pointer"` — XR hand pinch

---

## XR + Networking (Avatars)

The `WebXR` component takes a reference to an avatar prefab — when a user enters XR, their avatar is spawned and synced to other users via `PlayerSync`.

Typical XR multiplayer setup:
1. Add `SyncedRoom` for room management
2. Add `WebXR` component and assign an avatar prefab (the prefab must have `PlayerState`)
3. The avatar prefab should have `SyncedTransform` on the root and any tracked parts (head, hands)
4. Use `PlayerState.isLocalPlayer` to distinguish between local and remote players (e.g. hide the local player's head mesh to avoid seeing it from inside)

The XRRig position is synced via the avatar's `SyncedTransform`. Controller/hand positions are synced as child objects of the avatar. See the [networking reference](networking.md) for full details on PlayerSync and PlayerState.

---

## Depth Sensing

WebXR depth sensing provides per-pixel depth information from the device's depth sensor. This enables realistic occlusion where real-world objects appear in front of virtual ones.

Enable via the `WebXR` component's depth sensing toggle, or request manually:
```ts
await NeedleXRSession.start("immersive-ar", {
  optionalFeatures: ["depth-sensing"]
});
```

Needle Engine uses the depth data automatically for occlusion when available — no additional code needed in most cases.

---

## Image Tracking

Track real-world images (markers) in AR sessions. Each tracked image maps a reference image to a 3D object that gets placed at the detected position. The `image-tracking` feature is automatically requested when `WebXRImageTracking` is in the scene.

```ts
import { WebXRImageTracking, WebXRImageTrackingModel } from "@needle-tools/engine";

// Set up image tracking from code:
const tracker = myObject.addComponent(WebXRImageTracking);
tracker.trackedImages = [
  new WebXRImageTrackingModel({
    url: "assets/my-marker.png",       // reference image URL
    widthInMeters: 0.09,                // physical size of the printed marker (9cm)
    object: my3DContent,                // Object3D or AssetReference to show at the marker
    imageDoesNotMove: false,            // true for wall/floor markers (more stable)
    hideWhenTrackingIsLost: true,       // hide when marker is no longer visible
  })
];

// Per-frame EventList fired while images are tracked (5.1+):
tracker.imageTracked.addEventListener(evt => {
  for (const img of evt.trackedImages) console.log(img.url, img.state);
});

// Listen for tracking updates:
tracker.onTrackedImage = (images) => {
  for (const img of images) {
    console.log(img.url, img.state);   // "tracked" or "emulated"
    img.applyToObject(myObj);           // apply position/rotation to an object
    img.applyToObject(myObj, 0.5);      // with smoothing (0–1)
  }
};
```

Tips for marker images:
- Use high-contrast images with distinct features
- Avoid repetitive patterns or solid colors
- `widthInMeters` must match the actual printed size — mismatched sizes cause floating/sinking

---

## DOM Overlay (HTML in AR)

WebXR DOM Overlay allows HTML elements to be displayed on top of the AR camera feed. Needle Engine handles this automatically — `dom-overlay` is requested by default for AR sessions.

During an AR session, HTML elements inside the `<needle-engine>` element are reparented into the AR overlay container so they remain visible. You can place buttons, UI, or any HTML content alongside your 3D scene, and it will appear as a 2D overlay in AR.

```html
<needle-engine src="assets/scene.glb">
  <!-- These elements will be visible as overlay during AR -->
  <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);">
    <button onclick="doSomething()">My AR Button</button>
  </div>
</needle-engine>
```

Access the overlay container from code:
```ts
// During an AR session:
this.context.arOverlayElement   // the DOM overlay container element
```

On Quest, DOM overlay is excluded (it interferes with `sessiongranted`). On Mozilla WebXR (e.g. Firefox Reality) and Needle App Clip, elements are automatically reparented to ensure visibility.

---

## iOS AR (USDZ + App Clip)

iOS Safari doesn't support WebXR natively. Needle Engine provides two paths:

**USDZ Quick Look** — Exports the scene as an interactive `.usdz` file that opens in Apple's AR viewer. Supports animations, audio, and basic interactions ("Everywhere Actions"). Configure via `USDZExporter` component or the `WebXR` component's USDZ settings.

**Needle App Clip (Needle Go)** — A native iOS app clip that provides real WebXR AR on iOS with full feature support (image tracking, plane detection, hand tracking). Starts automatically when the `WebXR` component is present and an iOS user taps the AR button. No extra setup needed — the App Clip loads the same web URL in a WebXR-capable native container.

```ts
// Use "ar" to automatically pick the best AR path per platform:
// Android/Quest → immersive-ar (WebXR), iOS → USDZ Quick Look or App Clip
await NeedleXRSession.start("ar");

// Force USDZ Quick Look specifically:
await NeedleXRSession.start("quicklook");

// immersive-ar is standard WebXR — works on Android, Quest, visionOS
// On iOS, Needle Engine automatically launches the Needle App Clip (Needle Go) to provide WebXR support
await NeedleXRSession.start("immersive-ar");

// 5.1+ — launch a custom-branded App Clip (your own card title and image).
// Requires a registered appclip.needle.tools/x/… URL or experience id. PRO feature.
NeedleXRSession.appClipUrl = "https://appclip.needle.tools/x/your-experience";
```
