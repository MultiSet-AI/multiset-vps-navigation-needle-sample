# Needle Engine — Post-Processing Reference

Needle Engine uses the [pmndrs postprocessing](https://github.com/pmndrs/postprocessing) library. Postprocessing loads asynchronously via `NEEDLE_ENGINE_MODULES.POSTPROCESSING` (same pattern as physics). Add and remove effects via `this.context.postprocessing`.

## API (`this.context.postprocessing`)
```ts
import { BloomEffect } from "@needle-tools/engine";

// Add/remove effects
const bloom = new BloomEffect();
bloom.intensity.value = 3;
bloom.threshold.value = 0.5;
this.context.postprocessing.addEffect(bloom);
this.context.postprocessing.removeEffect(bloom);

// Other API
this.context.postprocessing.markDirty();             // force rebuild next frame
this.context.postprocessing.effects;                 // readonly array of active effects
this.context.postprocessing.multisampling = "auto";  // "auto" or number (0 to max)
this.context.postprocessing.adaptiveResolution = true; // reduce DPR when FPS drops
```

## Built-in effects

All imported from `@needle-tools/engine`. Properties use `VolumeParameter` — set values with `.value`:

```ts
// Bloom — glow on bright areas
const bloom = new BloomEffect();
bloom.threshold.value = 0.9;     // brightness cutoff (default: 0.9)
bloom.intensity.value = 1;       // glow strength (default: 1)
bloom.scatter.value = 0.7;       // spread (default: 0.7)

// Depth of Field — focus blur
import { DepthOfField, DepthOfFieldMode } from "@needle-tools/engine";
const dof = new DepthOfField();
dof.mode = DepthOfFieldMode.Bokeh;  // Off, Gaussian, or Bokeh
dof.focusDistance.value = 1;         // focus distance
dof.focalLength.value = 0.2;        // focus range
dof.aperture.value = 20;            // bokeh scale

// Vignette — darkened edges
const vig = new Vignette();
vig.intensity.value = 0.5;      // darkness (default: 0)
vig.color.value = { r: 0, g: 0, b: 0, a: 1 };

// Color Adjustments — exposure, contrast, hue, saturation
const ca = new ColorAdjustments();
ca.postExposure.value = 1;      // exposure (default: 1)
ca.contrast.value = 0;          // -1 to 1
ca.hueShift.value = 0;          // hue rotation
ca.saturation.value = 0;        // saturation adjustment

// Tonemapping
const tm = new ToneMappingEffect();
tm.setMode("AgX");              // ACES, AgX, Neutral, etc.
tm.exposure.value = 1;

// Chromatic Aberration — color fringing
const chr = new ChromaticAberration();
chr.intensity.value = 0.5;

// Pixelation
const pix = new PixelationEffect();
pix.granularity.value = 10;     // pixel size

// SSAO — ambient occlusion
const ssao = new ScreenSpaceAmbientOcclusion();
ssao.intensity.value = 2;
ssao.samples.value = 9;         // quality vs performance
ssao.falloff.value = 1;
ssao.color.value = new Color(0, 0, 0);

// N8AO — alternative AO (higher quality)
import { ScreenSpaceAmbientOcclusionN8, ScreenSpaceAmbientOcclusionN8QualityMode } from "@needle-tools/engine";
const n8ao = new ScreenSpaceAmbientOcclusionN8();
n8ao.aoRadius.value = 1;        // world-space radius
n8ao.intensity.value = 1;
n8ao.quality = ScreenSpaceAmbientOcclusionN8QualityMode.Medium;

// Antialiasing (SMAA)
const aa = new Antialiasing();
aa.preset.value = 2;            // 0=Low, 1=Medium, 2=High, 3=Ultra

// Tilt Shift — miniature/diorama look
const ts = new TiltShiftEffect();
ts.focusArea.value = 0.4;       // in-focus band size
ts.feather.value = 0.3;         // blur transition
ts.offset.value = 0;            // vertical offset
ts.rotation.value = 0;          // angle

// Sharpening
const sharp = new SharpeningEffect();
sharp.amount = 1;               // strength (direct property, not VolumeParameter)
sharp.radius = 1;               // radius
```

## Runtime parameter changes
```ts
// VolumeParameter values update the underlying shader uniforms immediately
bloom.intensity.value = 5;  // takes effect next frame, no rebuild needed

// Enable/disable individual effects
bloom.enabled = false;       // removes from pipeline
```

## Notes
- Post-processing is disabled during XR sessions.
- Multisampling auto-adjusts: disabled when SMAA is present, scales down on low FPS, scales up when stable.
- Effects are automatically ordered (Bloom before Vignette before ToneMapping, etc.). Custom effects can set `order` to control placement.
- Alpha is preserved through the pipeline.
