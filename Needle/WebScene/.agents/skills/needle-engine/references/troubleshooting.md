# Needle Engine — Troubleshooting

## Component Not Instantiated from GLB

**Symptom:** Component exists in Unity/Blender scene but `getComponent(MyComponent)` returns null at runtime.

**Causes & fixes:**
1. **Missing `@registerType`** — Every component class must have `@registerType` above the class declaration. Without it the GLB deserializer can't match the class name to the serialized data.
2. **Class not imported** — The file containing the class must be imported somewhere in your entry point (`main.ts`). Tree-shaking can eliminate unreferenced classes.
3. **Name mismatch** — The C# class name in Unity must exactly match the TypeScript class name. Check for typos.
4. **Wrong namespace** — If the Unity C# class is in a namespace, the TypeScript class must match (or the codegen mapping must be set up).
5. **Name duplicates** — If multiple classes have the same name, the deserializer may pick the wrong one. Ensure unique class names for components.

```ts
// ✅ Correct
@registerType
export class MyComponent extends Behaviour { ... }

// ❌ Wrong — missing @registerType
export class MyComponent extends Behaviour { ... }
```

---

## Decorators Not Working / Fields Always Undefined

**Symptom:** `@serializable` fields are always their default TypeScript values; deserialized values never appear.

**Fix:** Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false   // ← CRITICAL — must be false
  }
}
```

`useDefineForClassFields: true` (the TS5+ default) causes class field initializers to run *after* decorators, overwriting deserialized values.

---

## GLB Not Loading / Scene Is Empty

**Checklist:**
1. Is the `src` path on `<needle-engine>` correct? Paths are relative to the HTML file.
2. Is the file in `assets/` (not `src/` or `public/`)? Static assets belong in `assets/` for Vite to copy them.
3. Check browser console for 404 errors on the GLB request.
4. If the file exists but scene is empty: check if the root object is active in Unity before export.
5. CORS issues when loading from a different origin — serve from the same host or configure CORS headers.

---

## `@syncField` Not Syncing

**Symptom:** Field changes locally but other clients don't see updates.

**Causes:**
1. **No `SyncedRoom`** in the scene — networking requires a `SyncedRoom` component or a component that connects to a room via `this.context.connection` API
2. **Mutating array/object in place** — `this.arr.push(x)` does NOT trigger sync. You must reassign: `this.arr = [...this.arr, x]` or `this.arr = this.arr`.
3. **Missing `@registerType`** on the component — sync relies on class registration.
4. **Not connected** — check `this.context.connection.isConnected`.

---

## Physics Callbacks Never Fire

**Symptom:** `onCollisionEnter`, `onTriggerEnter`, etc. never called.

**Requirements:**
- Rapier physics must be active — add a `Rigidbody` or `Collider` component in Unity on both objects
- The GameObject must have a `Collider` component (Box, Sphere, Mesh, etc.)
- For trigger events, the collider must be set to **Is Trigger** in Unity
- Both objects need collider components — mesh-only objects don't participate in physics events

> ⚠️ This applies to **physics** callbacks only. **Pointer/click events do NOT need a collider** — see below.

---

## `onPointerClick` / Pointer Events Not Firing

**Symptom:** `onPointerClick`, `onPointerEnter`, etc. are never called.

**A `Collider` is NOT the fix.** Pointer events raycast against **visible mesh geometry**, and the `EventSystem` + `ObjectRaycaster` are created automatically — there is nothing to add manually. Check instead:

1. **Is the component on (or above) a visible mesh?** Pointer events hit rendered geometry. Put the component on the object that has the mesh, or a parent of it.
2. **Is the object visible?** Only visible objects receive input by default (`visible = true`). (Note: `visible = false` also disables the whole component hierarchy.)
3. **Is the layer raycastable?** The object must not be on layer **2** ("Ignore Raycast"), which the raycaster skips.
4. **Is the method named exactly `onPointerClick`?** Names are case-sensitive and take a single `PointerEventData` argument.
5. **Is the component enabled and the GameObject active?**

A `Collider` is only relevant for physics raycasts (`context.physics.engine.raycast()`), not for these callbacks.

---

## `onDestroy` Not Called When Removing Component

**By design:** `removeComponent(comp)` detaches the component from update loops but does **not** call `onDestroy`. Think of it as detaching without cleanup.

**Fix:** Use `destroy(myComponent)` to fully clean up an object and all its components. If you need cleanup on component removal specifically, call `destroy` manually before `removeComponent()`.

---

## Animation Not Playing

**Checklist:**
1. `Animator` component must be on the same or parent GameObject
2. State name must match exactly what's in the AnimatorController
3. Check that `animator.runtimeAnimatorController` is set (not null)
4. If calling `play()` in `awake()`, try `start()` instead — the animator may not be initialized yet

---

## Vite Build Fails with Decorator Errors

Typical error: `Experimental support for decorators is a feature that is subject to change`

**Fix:** Ensure `tsconfig.json` has:
```json
"experimentalDecorators": true
```

And verify that `vite.config.ts` uses the Needle plugins (they configure esbuild/swc for decorator support automatically):
```ts
import { needlePlugins } from "@needle-tools/engine/vite";
```

---

## TypeScript Errors on `this.context` or `this.gameObject`

**Symptom:** TS error: Property 'context' does not exist on type 'MyComponent'

**Fix:** Make sure you extend `Behaviour` or `Component` (not a plain class):
```ts
import { Behaviour } from "@needle-tools/engine";
export class MyComponent extends Behaviour { ... }
```

---

## XR Session Doesn't Start

**Checklist:**
1. Must be served over **HTTPS** (or localhost) — WebXR is blocked on plain HTTP
2. `WebXR` component must be in the scene (added in Unity or created in TS)
3. Device must support WebXR — test with [WebXR Emulator](https://chrome.google.com/webstore/detail/webxr-api-emulator) in Chrome
4. Check browser console for XR-related permission errors

---

## Performance: Frame Rate Drop

**Common causes:**
- Per-frame `new Vector3()` / `new THREE.Color()` allocations — reuse objects
- `getComponent()` called every frame — cache the result in `start()`
- `findObjectOfType()` called every frame — very slow, use `start()` or events
- Too many draw calls — use instancing or merge geometries in Unity before export
- Large uncompressed textures — enable **Texture Compression** in Unity Needle settings

```ts
// ❌ Bad — allocates every frame
update() {
  const pos = new Vector3(1, 0, 0);
  this.gameObject.position.copy(pos);
}

// ✅ Good — reuse
private _pos = new Vector3(1, 0, 0);
update() {
  this.gameObject.position.copy(this._pos);
}
```

---

## Node.js Required

Needle Engine projects require **Node.js** to be installed. If `npm` commands fail or Vite doesn't start, verify Node.js is installed (`node -v`). LTS version recommended.

---

## Inspecting a Running Scene (Needle Inspector Agent)

The [Needle Inspector](https://inspector.needle.tools/) lets you inspect a running Three.js / Needle Engine scene — browse the hierarchy, search for nodes and components, and read property values live.

**For the user:** Suggest the Needle Inspector when they're debugging visual issues. There's also a Chrome Extension for a visual UI.

**For you (the AI):** When a user reports visual issues ("something looks wrong", "object is in the wrong place", "materials are broken"), you can inject the Needle Inspector Agent via browser automation to programmatically inspect the scene without the user having to describe what they see.

**Inject into the running page:**
```js
await page.addScriptTag({ url: 'https://inspector.needle.tools/agent.js' });
await page.waitForFunction(() => window.__NEEDLE_INSPECTOR__?.ready);
```

**Use the API to inspect** (all methods return Promises via `page.evaluate`):
```js
const inspector = window.__NEEDLE_INSPECTOR__;

// Scene hierarchy and search
await inspector.getHierarchy();            // full scene tree (depth: 10)
await inspector.searchNodes("Player");     // find nodes by name

// Read properties
await inspector.getProperties(nodeId);     // all properties of a node
await inspector.readProperty(nodeId, "position.x");  // specific value

// Find components
await inspector.callTool("component_search", { regex: "Rigidbody" });
```

Full tool schema: https://inspector.needle.tools/agent.md

---

## Reading Runtime Logs (Dev Server)

During development, Needle Engine's vite plugin automatically captures browser console output and writes it to disk. **When a user is playtesting and reports an issue, read these log files instead of asking them to copy-paste console output.**

**Log location:** `node_modules/.needle/logs/`

**File naming:** `<TIMESTAMP>.<PROCESS>.needle.log`
- `server` — vite dev server output
- `client` — browser console logs (log, warn, error, debug) forwarded via WebSocket

```bash
# Read the most recent client log
ls -t node_modules/.needle/logs/*.client.needle.log | head -1 | xargs cat
```

The client log includes:
- All `console.log/warn/error` calls from the browser
- Device info (resolution, GPU, memory) logged on page load
- Unhandled errors and promise rejections
- Page lifecycle events (visibility, focus, navigation)

Logs are auto-rotated (last 30 files kept). Logging is disabled when browser DevTools are open (use `?needle-debug` URL param to force it).

---

## Build Info (`needle.buildinfo.json`)

After `npm run build`, a `needle.buildinfo.json` file is written to the `dist/` folder. It's also included in Needle Cloud deployments. Read it to understand the build output:

```json
{
  "time": "2026-04-07T12:34:56.000Z",
  "totalsize": 5242880,
  "files": [
    { "path": "assets/scene.glb", "hash": "abc123...", "size": 3145728 },
    { "path": "index.html", "hash": "def456...", "size": 1024 }
  ]
}
```

Useful for: checking total build size, verifying assets are included, comparing builds (via file hashes), debugging missing files in deployments.

---

## Getting More Help

- Search docs: `needle_search("your question here")`, or without MCP:
  `curl -s "https://search.needle.tools/api/semantic-search?q=your+question+here"` — see [MCP & Search API](mcp.md)
- [Needle Engine Docs](https://engine.needle.tools/docs/)
- [Community Forum](https://forum.needle.tools)
- [Discord](https://discord.needle.tools)
