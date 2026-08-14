# Needle Engine — Framework Integration

## React

### Listen for 3D events in a component
```tsx
import { useEffect, useState } from "react";

function ScoreDisplay() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const ne = document.querySelector("needle-engine");
    const handler = (e: CustomEvent) => setScore(e.detail.score);
    ne?.addEventListener("score-changed", handler as EventListener);
    return () => ne?.removeEventListener("score-changed", handler as EventListener);
  }, []);

  return <div>Score: {score}</div>;
}
```

### Call into the 3D scene from React
```tsx
function GameControls() {
  const addScore = async () => {
    const { findObjectOfType } = await import("@needle-tools/engine");
    const { MyScoreManager } = await import("./scripts/MyScoreManager.js");
    findObjectOfType(MyScoreManager)?.addScore(10);
  };
  return <button onClick={addScore}>+10</button>;
}
```

### Use engine hooks from React
```tsx
useEffect(() => {
  import("@needle-tools/engine").then(({ onStart }) => {
    onStart((ctx) => {
      // safe to access components here
    });
  });
}, []);
```

---

## Svelte / SvelteKit

```svelte
<script>
  import { onMount } from "svelte";
  let score = 0;

  onMount(async () => {
    // Dynamic import required for SSR — engine needs browser APIs
    const { onStart } = await import("@needle-tools/engine");

    // onStart fires once when the context/scene is ready — never poll with setInterval
    onStart(ctx => {
      // Safe to access components, add components, etc.
      console.log("Scene ready:", ctx.scene);
    });

    // Listen for custom events from 3D components
    const ne = document.querySelector("needle-engine");
    const handler = (e) => (score = e.detail.score);
    ne?.addEventListener("score-changed", handler);
    return () => ne?.removeEventListener("score-changed", handler);
  });

  async function addScore() {
    const { findObjectOfType, Context } = await import("@needle-tools/engine");
    const { MyScoreManager } = await import("../scripts/MyScoreManager.js");
    findObjectOfType(MyScoreManager, Context.Current)?.addScore(10);
  }
</script>

<p>Score: {score}</p>
<button on:click={addScore}>+10</button>
<needle-engine src="assets/scene.glb" />
```

---

## Vue / Nuxt

```vue
<template>
  <div>Score: {{ score }}</div>
  <needle-engine src="assets/scene.glb" ref="ne" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const score = ref(0);
const ne = ref(null);

function onScore(e) { score.value = e.detail.score; }

onMounted(() => {
  ne.value?.addEventListener("score-changed", onScore);
  import("@needle-tools/engine").then(({ onStart }) => {
    onStart((ctx) => {
      // safe to access components here
    });
  });
});
onUnmounted(() => ne.value?.removeEventListener("score-changed", onScore));
</script>
```

---

## Vanilla JS / No Framework

```html
<needle-engine src="assets/scene.glb"></needle-engine>

<script type="module">
  import { onStart, onUpdate } from "@needle-tools/engine";

  onStart((ctx) => {
    console.log("Scene ready:", ctx.scene);
  });
</script>
```

---

## CDN with Import Maps (no bundler, no npm)

For quick prototypes, embedding in existing sites, or projects without a build pipeline. Use `<script type="importmap">` to map bare specifiers to CDN URLs, then write standard ES module code — no Vite, no npm, no `node_modules` required.

### Simple CDN (core components only, no custom code)

A single script tag registers the `<needle-engine>` web component with all built-in components:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@needle-tools/engine/dist/needle-engine.min.js"></script>
<needle-engine src="https://your-site.com/assets/scene.glb" camera-controls></needle-engine>
```

### Import maps (custom code)

Unlike the single-script approach, import maps let you write custom logic with proper `import` statements:

```html
<!-- Import map MUST appear before any <script type="module"> -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/@needle-tools/engine/dist/three.min.js",
    "@needle-tools/engine": "https://cdn.jsdelivr.net/npm/@needle-tools/engine/dist/needle-engine.min.js"
  }
}
</script>
<script type="module">
  import { onStart, ObjectUtils } from "@needle-tools/engine";
  import { Object3D, Vector3 } from "three";

  onStart(ctx => {
    const cube = ObjectUtils.createPrimitive("Cube", {
      position: new Vector3(0, 0.5, 0),
    });
    ctx.scene.add(cube);
  });
</script>
<needle-engine camera-controls environment-image="studio"></needle-engine>
```

### Full HTML page example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Needle Engine CDN</title>
  <style>
    body { margin: 0; }
    needle-engine { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <needle-engine src="assets/scene.glb" camera-controls auto-rotate environment-image="studio"></needle-engine>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/@needle-tools/engine/dist/three.min.js",
      "@needle-tools/engine": "https://cdn.jsdelivr.net/npm/@needle-tools/engine/dist/needle-engine.min.js"
    }
  }
  </script>
  <script type="module">
    import { onStart } from "@needle-tools/engine";

    onStart(ctx => {
      console.log("Scene loaded:", ctx.scene.children.length, "root objects");
    });
  </script>
</body>
</html>
```

### CDN rules & gotchas

- **three.js MUST come from Needle's dist** — map `"three"` to `@needle-tools/engine/dist/three.min.js`, NOT a standalone `three` CDN package. Needle re-exports a compatible three.js build; a separate copy causes duplicate-module issues (`instanceof` checks fail, shaders break).
- The `<script type="importmap">` tag must appear **before** any `<script type="module">` tags — browsers reject import maps added after module loading starts.
- Works in all modern browsers: Chrome 89+, Safari 16.4+, Firefox 108+.
- No TypeScript — CDN import maps load plain JavaScript. For TypeScript or decorators, use the Vite workflow (`npm create needle`).
- No tree-shaking — the CDN bundle includes all built-in components. For production apps where bundle size matters, use the Vite workflow.
- **Do NOT mix with bundlers** — if using Vite, do not add import maps. The bundler handles resolution; an import map would cause duplicate module instances.

### When to use which

| Approach | Custom code | Build step | Best for |
|---|---|---|---|
| Simple CDN script | No | No | Embedding pre-built GLBs on existing sites |
| CDN + import maps | Yes | No | Prototypes, demos, learning, small integrations |
| `npm create needle` (Vite) | Yes | Yes | Production apps, TypeScript, tree-shaking, full workflow |

---

## Engine Hooks Reference

These standalone functions from `@needle-tools/engine` mirror the component lifecycle but work outside of a class:

| Hook | When it fires |
|---|---|
| `onInitialized(cb)` | Once after context creation and first content load |
| `onStart(cb)` | Once when the context/scene is ready |
| `onUpdate(cb)` | Every frame (before rendering) |
| `onBeforeRender(cb)` | Just before Three.js renders |
| `onAfterRender(cb)` | Just after Three.js renders |
| `onClear(cb)` | Before context is cleared (e.g. when `src` changes) |
| `onDestroy(cb)` | When the context is torn down |

All callbacks receive `(ctx: Context)` as their argument.

### Client-only (no SSR)
When server-side rendering is **disabled**, import and call hooks directly:
```ts
import { onStart, onUpdate, onBeforeRender, onDestroy } from "@needle-tools/engine";

onStart((ctx) => { /* setup */ });
onUpdate((ctx) => { /* per-frame logic */ });
onDestroy((ctx) => { /* cleanup */ });
```

### Server-side rendering (SSR)
`@needle-tools/engine` is a WebGL / browser library. **Use a dynamic import so the module only loads client-side** — this is the recommended pattern for Next.js, SvelteKit, Nuxt, and anything else that renders on the server:
```ts
import("@needle-tools/engine").then(({ onStart, onUpdate, onDestroy }) => {
  onStart((ctx) => { /* setup */ });
  onUpdate((ctx) => { /* per-frame logic */ });
  onDestroy((ctx) => { /* cleanup */ });
});
```
In Svelte that's an `await import(...)` inside `onMount`; in React, an effect or `next/dynamic` with `ssr: false`.

Rendering the `<needle-engine>` **tag** during SSR is fine either way — it's emitted as inert HTML and upgrades once the engine loads on the client.

**5.1 added experimental server-side imports**, so a top-level `import` is expected to work on 5.1+. It's still marked experimental, so prefer the dynamic import above unless you've verified it in the specific framework. Two things that *are* safe at module level today:
- the `needle` shorthand (`import { needle } from "@needle-tools/engine"`) — explicitly documented as SSR-safe, since it's a lazy Proxy. Only *access* it inside handlers/callbacks, never at module top-level.
- type-only imports (`import type { ... }`), which are erased at compile time.

### JSX types
Type declarations for `<needle-engine>` ship with the package, so React, Preact, and SolidJS get attribute autocomplete with no extra setup.
