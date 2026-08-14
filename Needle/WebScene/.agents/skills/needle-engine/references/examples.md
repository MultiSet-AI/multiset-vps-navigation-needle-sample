# Needle Engine — Component Examples

Practical examples of common component patterns. All components extend `Behaviour` from `@needle-tools/engine`.

---

## Rotate an object

```ts
import { Behaviour, serializable, registerType } from "@needle-tools/engine";

@registerType
export class Rotate extends Behaviour {
  @serializable() speed: number = 1;

  update() {
    this.gameObject.rotation.y += this.speed * this.context.time.deltaTime;
  }
}
```

---

## Respond to clicks

```ts
import { Behaviour, registerType } from "@needle-tools/engine";
import type { PointerEventData } from "@needle-tools/engine";

@registerType
export class ClickHandler extends Behaviour {

  onPointerClick(args: PointerEventData) {
    console.log("Clicked:", this.gameObject.name);
    // Scale up briefly on click
    this.gameObject.scale.multiplyScalar(1.2);
    setTimeout(() => this.gameObject.scale.multiplyScalar(1 / 1.2), 200);
  }

  // Other pointer events: onPointerEnter, onPointerExit, onPointerDown, onPointerUp, onPointerMove
}
```

Pointer events work out of the box — just add a component with `onPointerClick` (or another pointer method) to an object with a **visible mesh**. The `EventSystem` and an `ObjectRaycaster` are created **automatically** by the engine (in every workflow, including code-only); you do not add them manually. A `Collider` is **not** required for clicks — colliders are only used for physics raycasts (`context.physics.engine.raycast()`).

---

## Load a GLB at runtime

```ts
import { Behaviour, AssetReference, serializable, registerType } from "@needle-tools/engine";
import { Object3D } from "three";

@registerType
export class RuntimeLoader extends Behaviour {
  // Set in Unity/Blender inspector, or assign from code
  @serializable(AssetReference) model?: AssetReference;

  async start() {
    // Option 1: From a serialized AssetReference
    if (this.model) {
      const instance = await this.model.instantiate({ parent: this.gameObject });
    }

    // Option 2: From a URL (code-only)
    const ref = AssetReference.getOrCreate(this.context.domElement.baseURI, "assets/chair.glb");
    const chair = await ref.instantiate({ parent: this.gameObject });
  }
}
```

---

## Synced multiplayer state

```ts
import { Behaviour, serializable, registerType, syncField } from "@needle-tools/engine";

@registerType
export class SyncedCounter extends Behaviour {
  // @syncField handles networking sync; add @serializable() too if the field should also
  // deserialize from GLB (when set in Unity/Blender). For code-only components, @syncField alone is fine.
  @syncField(SyncedCounter.prototype.onCountChanged)
  count: number = 0;

  private onCountChanged(newValue: number, oldValue: number) {
    console.log(`Count changed: ${oldValue} → ${newValue}`);
  }

  increment() {
    this.count += 1; // reassignment triggers sync
  }

  // For arrays/objects: must reassign to trigger sync
  @syncField() tags: string[] = [];

  addTag(tag: string) {
    this.tags.push(tag);
    this.tags = this.tags; // force sync
  }
}
```

---

## Change materials at runtime

```ts
import { Behaviour, Renderer, registerType } from "@needle-tools/engine";
import { MeshStandardMaterial, Color } from "three";

@registerType
export class ColorChanger extends Behaviour {

  onPointerClick() {
    // Option 1: Via Renderer component (if available, e.g. from Unity/Blender export)
    const renderer = this.gameObject.getComponent(Renderer);
    if (renderer?.sharedMaterial) {
      (renderer.sharedMaterial as MeshStandardMaterial).color = new Color(Math.random(), Math.random(), Math.random());
    }

    // Option 2: Direct Three.js access (always works)
    this.gameObject.traverse(child => {
      if ((child as any).material) {
        (child as any).material.color = new Color(Math.random(), Math.random(), Math.random());
      }
    });
  }
}
```

---

## Set up a scene from code (no Unity/Blender)

Use `onStart` to safely access the context — never poll with `setInterval`.

```ts
import { onStart, ObjectUtils, PrimitiveType, ContactShadows, SyncedRoom } from "@needle-tools/engine";
import { DirectionalLight, AmbientLight } from "three";

onStart(ctx => {
  // Lighting
  const dirLight = new DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  ctx.scene.add(dirLight);
  ctx.scene.add(new AmbientLight(0xffffff, 0.5));

  // Ground
  const ground = ObjectUtils.createPrimitive(PrimitiveType.Cube, {
    color: 0x888888,
    scale: { x: 10, y: 0.1, z: 10 }
  });
  ctx.scene.add(ground);

  // Some objects
  for (let i = 0; i < 5; i++) {
    const sphere = ObjectUtils.createPrimitive(PrimitiveType.Sphere, {
      color: Math.random() * 0xffffff,
      position: { x: (i - 2) * 2, y: 1, z: 0 }
    });
    ctx.scene.add(sphere);
  }

  // Shadows
  ContactShadows.auto(ctx);
});
```

---

## Keyboard input

```ts
import { Behaviour, registerType } from "@needle-tools/engine";
import { Vector3 } from "three";

@registerType
export class KeyboardMover extends Behaviour {
  speed: number = 5;

  update() {
    const dt = this.context.time.deltaTime;
    const input = this.context.input;

    // Key codes: use KeyCode values ("KeyW", "Space", "ArrowLeft") or lowercase letters ("w")
    if (input.getKeyPressed("KeyW")) this.gameObject.position.z -= this.speed * dt;
    if (input.getKeyPressed("KeyS")) this.gameObject.position.z += this.speed * dt;
    if (input.getKeyPressed("KeyA")) this.gameObject.position.x -= this.speed * dt;
    if (input.getKeyPressed("KeyD")) this.gameObject.position.x += this.speed * dt;

    if (input.getKeyDown("Space")) {
      console.log("Jump!");
    }
  }
}
```

---

## First-person camera movement

Three.js cameras look down `-Z`, so `getWorldDirection` returns the negated forward. Use `worldForward` from Needle's Object3D extensions instead — it handles this correctly. Note: `worldForward` works on `ctx.mainCamera` because Needle patches all Object3D instances, including Three.js cameras.

```ts
import { Behaviour, registerType } from "@needle-tools/engine";
import { Vector3 } from "three";

@registerType
export class FirstPersonMove extends Behaviour {
  speed: number = 5;
  private _forward = new Vector3();
  private _right = new Vector3();

  update() {
    const dt = this.context.time.deltaTime;
    const input = this.context.input;
    const cam = this.context.mainCamera;
    if (!cam) return;

    // Use Needle's worldForward/worldRight — correctly handles Three.js -Z convention
    this._forward.copy(cam.worldForward);
    this._forward.y = 0;
    this._forward.normalize();

    this._right.copy(cam.worldRight);
    this._right.y = 0;
    this._right.normalize();

    let moveX = 0, moveZ = 0;

    if (input.getKeyPressed("KeyW")) { moveX += this._forward.x; moveZ += this._forward.z; }
    if (input.getKeyPressed("KeyS")) { moveX -= this._forward.x; moveZ -= this._forward.z; }
    if (input.getKeyPressed("KeyA")) { moveX -= this._right.x; moveZ -= this._right.z; }
    if (input.getKeyPressed("KeyD")) { moveX += this._right.x; moveZ += this._right.z; }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      cam.position.x += (moveX / len) * this.speed * dt;
      cam.position.z += (moveZ / len) * this.speed * dt;
    }
  }
}
```

---

## Coroutine (timed sequence)

```ts
import { Behaviour, registerType, WaitForSeconds } from "@needle-tools/engine";

@registerType
export class TrafficLight extends Behaviour {

  start() {
    this.startCoroutine(this.cycle());
  }

  *cycle() {
    while (true) {
      this.setColor("green");
      yield WaitForSeconds(5);
      this.setColor("yellow");
      yield WaitForSeconds(2);
      this.setColor("red");
      yield WaitForSeconds(5);
    }
  }

  private setColor(color: string) {
    console.log("Light:", color);
  }
}
```
