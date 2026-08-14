/**
 * Needle Engine — Annotated Component Template
 *
 * Copy this file and rename the class to get started.
 * Remove any lifecycle methods you don't need.
 */

import { Behaviour, serializable, registerType, WaitForSeconds } from "@needle-tools/engine";
import { Object3D } from "three";

// @registerType — required for GLB deserialization.
// Without this, the component won't be instantiated from GLB.
@registerType
export class MyComponent extends Behaviour {

  // ---------------------------------------------------------------------------
  // Serialized Fields
  // These values are set in the Unity Inspector and baked into the GLB.
  // ---------------------------------------------------------------------------

  /** A simple number field — set in Unity Inspector */
  @serializable()
  speed: number = 1;

  /** A reference to another object in the scene */
  @serializable(Object3D)
  target?: Object3D;

  // ---------------------------------------------------------------------------
  // Private State
  // ---------------------------------------------------------------------------

  private _elapsed: number = 0;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  awake() {
    // Called once when the component is instantiated (even if disabled).
    // Use for initialization that doesn't depend on other components being ready.
  }

  start() {
    // Called once on the first frame the component is active.
    // Other components are initialized by now — safe to call getComponent() etc.
    console.log(`${this.name} started on ${this.gameObject.name}`);
  }

  update() {
    // Called every frame. Use this.context.time.deltaTime for frame-rate independence.
    this._elapsed += this.context.time.deltaTime;

    // Example: rotate this object
    this.gameObject.rotation.y += this.speed * this.context.time.deltaTime;
  }

  onEnable() {
    // Called each time this component becomes active.
  }

  onDisable() {
    // Called each time this component becomes inactive.
  }

  onDestroy() {
    // Called when this component/object is destroyed (via destroy(obj)).
    // Note: NOT called by removeComponent() — only by the standalone destroy() function.
    // Clean up event listeners, timers, or external references here.
  }

  // ---------------------------------------------------------------------------
  // Physics callbacks (require a Rapier Collider on this GameObject)
  // ---------------------------------------------------------------------------

  // onCollisionEnter(col: Collision) { }
  // onTriggerEnter(col: Collision)   { }

  // ---------------------------------------------------------------------------
  // Example: coroutine
  // ---------------------------------------------------------------------------

  private *exampleCoroutine() {
    // yield;                    // wait one frame
    // yield WaitForSeconds(1);  // wait 1 second
  }
}
