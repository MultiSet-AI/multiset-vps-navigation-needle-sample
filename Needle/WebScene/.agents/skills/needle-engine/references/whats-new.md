# Needle Engine — What's New (5.1 → 6.0)

APIs added since 5.1.0 (June 2026). Current release line is **6.0.0-alpha**. If the project's `@needle-tools/engine` is older than the version noted, the API isn't there — check `package.json`.

---

## Scene Bindings — typed scene access (5.1) *(experimental)*

GLB scenes get auto-generated TypeScript types. Access nodes and components with autocomplete instead of `getComponent` + string lookups. Types regenerate when scene files change; works with local files, remote URLs, and Needle Cloud assets.

Reachable as `this.context.sceneData` inside a component, `ctx.sceneData` in an `onStart(ctx => …)` callback, or `needle.sceneData` from anywhere that runs after the scene starts.

```ts
export class MyComponent extends Behaviour {
  start() {
    const cam   = this.context.sceneData.MyScene.MainCamera.$object;                    // THREE.PerspectiveCamera
    const orbit = this.context.sceneData.MyScene.MainCamera.$components.OrbitControls;  // typed component
    orbit.autoRotate = true;
  }
}
```

**The shape is `sceneData.<GlbName>.<NodeName>[.<ChildNode>…].$components.<ComponentName>`.** Two things bite here:

- **Bare property names resolve to child nodes, not components.** `sceneData.MyScene.MainCamera.OrbitControls` looks for a *child object* named `OrbitControls` and won't find the component. Components always need `$components`. Use `$object` for the underlying `Object3D`.
- **Lookup failures don't throw.** A missing node or component returns an error proxy that absorbs every get/set and logs a warning. `sceneData.Foo.Bar.baz = 1` on a typo silently does nothing rather than crashing — so if a scene-bindings assignment "runs" but has no effect, check the console for `[SceneData]` warnings.

The GLB-name level is ignored at runtime (node lookup starts at the scene root); it exists so the generated types can be per-file.

## `needle` shorthand (5.1) *(experimental)*

Context access from anywhere, without threading `ctx` through your code. The payoff is in plain callbacks — DOM handlers, framework components, timers — that would otherwise need an `onStart` wrapper purely to capture a context:

```ts
import { needle, onStart } from "@needle-tools/engine";

// With `needle` — the handler resolves the current context when it fires
button.onclick = () => {
  needle.sceneData.MyScene.Camera.$components.OrbitControls.autoRotate = true;
};

// Without it — a wrapper whose only job is handing you a ctx
onStart(ctx => {
  button.onclick = () => {
    ctx.sceneData.MyScene.Camera.$components.OrbitControls.autoRotate = true;
  };
});
```

**Importing at module level is safe, including under SSR** — it's a lazy Proxy, so the import alone touches no browser APIs.

**Accessing it at module level is not.** Module bodies evaluate immediately, before any scene exists, so a top-level `needle.scene.traverse(...)` logs an error and returns a no-op error proxy — it appears to run and silently does nothing. Only touch `needle` from code that runs after the scene starts: event handlers, callbacks, component methods. For setup that must run at scene-ready, use `onStart(ctx => { ... })`.

Single-context assumption: on pages with multiple `<needle-engine>` elements, use `ctx` directly.

## `Context.events` — typed event bus (5.1)

Decoupled component communication. `on()` returns an unsubscribe function, which pairs with `autoCleanup`.

```ts
// Known events — full autocomplete
context.events.on("scene-content-changed", e => console.log(e.object, e.source));

// Custom events — type at the call site
context.events.emit<{ pts: number }>("scored", { pts: 10 });
context.events.on<{ pts: number }>("scored", e => e.pts);

// Once
context.events.on("scene-content-changed", e => { /* ... */ }, { once: true });
```

Built-in events: `scene-content-changed` (`{ source, object }` — fired by SceneSwitcher, DropListener, etc.) and `lifecycle-changed` (`{ context, lifecycle, previous }`).

## `autoCleanup` on `Behaviour` (5.1) *(experimental)*

Register disposables, cleanup functions, or unsubscribe functions against the component lifecycle. `null`/`undefined` are safe no-ops, so conditional subscriptions work without guards.

```ts
onEnable() {
    this.autoCleanup(this.context.input.addEventListener("pointerdown", evt => { /* ... */ }));
    this.autoCleanup(this.context.connection.beginListen("my-event", data => { /* ... */ }));
}
```

**Which cleanup store it lands in depends on *when* you call it** — this is the easy thing to get wrong:

| Called during | Cleaned up on |
|---------------|---------------|
| `onEnable` | `onDisable` (re-registered on re-enable) |
| `awake` / `start` | `onDestroy` (survives enable/disable cycles) |
| anywhere else (e.g. `update`) | `onDisable` |

So a subscription registered in `start()` is *not* torn down when the component is disabled. If you want disable-scoped cleanup, register in `onEnable`.

Many subscription APIs (input, networking, XR, `EventList.on`) now return unsubscribe functions specifically to feed this.

## Builder APIs (5.1) *(preview)*

`TimelineBuilder`, `AnimatorControllerBuilder`, and `AnimationBuilder` create timelines, controllers, and animations from code with typed keyframes and inline tracks. For procedural content and runtime-generated sequences.

```ts
const timeline = TimelineBuilder.create("MyTimeline")
    .animationTrack("Walk", animator).clip(walkClip, { duration: 2 })
    .activationTrack("FX", vfxObject).clip({ start: 1, duration: 0.5 })
    .build();
director.playableAsset = timeline;
```

Every track type places content with `clip(...)` — there is no `activate()` method, despite what
the 5.1.0 changelog sample shows. `duration` is required; `start` defaults to just after the
previous clip on that track. Also available: `easeIn` / `easeOut`, audio tracks (`clip(url, opts)`)
and control tracks (`clip(sourceObject, opts)`).

## `<needle-app>` — embed a published app (5.1)

Drop a deployed Needle app into any page. No build setup, no framework, handles cross-origin loading, works in iframes.

```html
<needle-app src="https://your-app.needle.run"></needle-app>
```

The deploy also emits `needle-app.js`, which re-exports the engine's public API bound to the *embedded* scene — so lifecycle hooks imported from it drive the live embed:

```js
import { onStart } from "https://your-deploy/needle-app.js";
onStart(ctx => { /* ... */ });
```

## `GaussianSplat` (6.0-alpha) *(experimental)*

Splat rendering via Spark, with LOD, correct bounds, and raycasting.

```ts
const splat = obj.addComponent(GaussianSplat);
splat.url = "assets/scan.spz";   // reassigning at runtime reloads
splat.opacity = 1;               // 0–1
splat.raycastable = true;
splat.quality = "auto";          // "auto" | "high" | "medium" | "low"
```

Formats: `.ply`, `.spz`, `.splat`, `.sog`, and `.rad` (6.0-alpha.2 — chunked and seekable, so it streams and loads progressively).

`quality: "auto"` resolves per device (mobile → low) and adapts at runtime: LOD density degrades in steps while frame rate is below target, and any step that doesn't measurably help is reverted. Explicit values are fixed. Note that sort throttling and LOD density apply to the scene's *shared* splat renderer — with several `GaussianSplat` components, the last applied quality wins for those.

Diagnostics: `?debugsplats` for sorting/LOD logging.

## Smaller additions

**Lighting (5.1)** — `context.lights` (all registered lights) and `context.mainLight` (brightest directional light, or `null`).

**Physics (5.1)** — raycasts take `includeTriggers`; triggers are excluded unless you pass `true`.
```ts
this.context.physics.raycast(origin, direction, { includeTriggers: true });
```

**Skybox (5.1)** — `background-rotation` / `environment-rotation` attributes on `<needle-engine>`, plus `background-image-loaded` / `environment-image-loaded` events.

**Image tracking (5.1)** — `WebXRImageTracking.imageTracked` is an `EventList` fired every frame while images are tracked. The event carries `trackedImages`:
```ts
tracker.imageTracked.addEventListener(evt => {
  for (const img of evt.trackedImages) console.log(img.url, img.state);
});
```
(The 5.1.0 changelog also advertises `resetImage` / `resetAllImages` — those don't exist in the source. Don't use them.)

**XR (5.1 / 6.0)** — `NeedleXRSession.appClipUrl` launches a custom-branded iOS AR App Clip (PRO). `Context.xrFrameRateLimit` caps XR session frame rate via WebXR `updateTargetFrameRate` where supported (mobile splat preset caps AR at 30 fps for thermals). WebXR anchors (`useAnchors`) are **on by default** as of 6.0-alpha.1.

**Audio (5.1)** — standalone `AudioClip` class with its own playback control; `AudioSource` gained spatial blend and `.opus` support.

**DragControls (5.1)** — new constraint system: `keepScale`, two-touch scale with min/max limits, refined hit regions, and a screen-space AR drag mode. Rotation is now limited to two-touch and XR controller input, so single-touch dragging is more predictable.

**OrbitControls (5.0)** — uses `lookAtTarget` / `lockLookAtTarget`. The `LookAtConstraint` component is deprecated.

**EventList (5.0)** — `addEventListener` returns a remove function: `const remove = list.addEventListener(() => {})`.

**three.js** — bundled three is **r185** as of 6.0-alpha.1.

## Vite plugin & frameworks

`needlePlugins()` can be called with no arguments — the Vite command is resolved automatically:

```js
export default defineConfig({ plugins: [sveltekit(), needlePlugins()] });
```

The `await needlePlugins(command, config, settings)` form still works and is still what you want when passing options (`makeFilesLocal`, etc.).

**JSX type declarations** ship for React, Preact, SolidJS and friends, so `<needle-engine>` gets autocomplete in JSX.

**SSR** — see [Framework Integration](integration.md#server-side-rendering-ssr).

Vite 8 / Rolldown is supported as of 5.0.
