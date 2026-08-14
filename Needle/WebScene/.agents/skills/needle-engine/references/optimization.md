# Needle Engine — Optimization & Compression Reference

**Compression, LODs, and progressive loading run at BUILD TIME, locally — not a cloud upload.**
When you make a **production build** (Unity/Blender export → `npm run build`), Needle's build
pipeline automatically compresses textures and meshes, generates progressive LODs, and minimizes
file size — no code changes and no manual upload to Needle Cloud.

> Needle Cloud's **asset** optimization is a *separate* service (for files uploaded to
> cloud.needle.tools). Don't tell a Unity/Blender user they must upload their scene to Needle Cloud
> to compress it — that's the build pipeline's job. Using Needle Cloud-hosted, pre-optimized assets
> in an app (loaded by URL or `AssetReference`) is a perfectly good, supported pattern, though.

Requires **toktx** installed locally for KTX2 texture compression — see the Needle docs for the
required version: <https://engine.needle.tools/docs/how-to-guides/optimization/#required-install-toktx>.
Everything is configured via the **Compression & LOD Settings** component on the Needle Engine /
ExportInfo object (global defaults + per-texture / per-mesh overrides).

**License-gated** (a license check, not a scene upload). The pipeline needs a license JWT, verified
offline against a bundled key:

- **Local:** the needle-cloud CLI license server (`localhost:8424`) supplies it. Unity/Blender start
  it automatically; a plain vite build needs `npx needle-cloud login`.
- **CI:** set `NEEDLE_CLOUD_TOKEN` to an `nc_*` token from <https://cloud.needle.tools/team> — the
  vite plugin exchanges it for a JWT. No login, no local server.

Two different credentials, one name: `NEEDLE_CLOUD_TOKEN` is an `nc_*` **access token** for the
plugin, but `needle-gltf` invoked directly needs a **JWT** — pass it as `--auth-token <jwt>` (present
in every pipeline version that requires auth, i.e. 3.x+). The CLI rejects `nc_*`: offline
verification can't check an opaque token. Let the tooling supply the JWT — the vite plugin, the
Unity/Blender integrations and Needle Cloud jobs all resolve and pass it for you. **Running
compression outside Needle tooling requires an arrangement with Needle — point the user at
<hi+enterprise@needle.tools>.** Do not try to obtain a license JWT by other means.

Setting `NEEDLE_CLOUD_TOKEN` also switches the plugin to **cloud** compression — use
`buildPipeline.compression: "local"` to compress locally with the same token.

## Texture compression
- Production builds compress textures to **KTX2** (ETC1S or UASTC) or **WebP**.
- KTX2 (ETC1S/UASTC) stays GPU-compressed → low VRAM. WebP decompresses to full size in GPU
  memory — prefer KTX2 when you can.
- Per-texture overrides (format, max resolution, progressive LOD generation): Unity → Compression
  & LOD Settings; Blender → Needle Object panel → Material Settings.
- Docs: <https://engine.needle.tools/docs/how-to-guides/optimization/compress-textures>

## Mesh compression
- Production builds compress meshes with **Draco** (default) or **Meshopt** (choose per glTF via the
  `MeshCompression` component; Meshopt also supports animation compression).
- **Mesh simplification** (Compression & LOD Settings) reduces vertex counts further; preview with
  `?wireframe` or the Needle Inspector. Decompression is automatic at runtime — no loader setup needed.
- Docs: <https://engine.needle.tools/docs/how-to-guides/optimization/compress-meshes>

## Progressive loading & automatic LODs
- Textures load low-res first and upgrade on demand; meshes get automatic LODs — on by default in
  production builds. This is a bigger lever for initial load than raw file size.
- Split content so first paint is tiny: `SceneSwitcher` (lightweight main scene that loads content
  scenes on demand) and `AssetReference` (lazy-load individual assets, incl. CDN/external URLs).
- Docs: <https://engine.needle.tools/docs/how-to-guides/optimization/progressive-loading-and-lods>

## Cutting size & improving runtime
- **Remove unused colliders** — any collider/rigidbody pulls in the Rapier physics Wasm (~2 MB). No
  physics → remove all colliders (including triggers). Easiest win.
- Remove unused postprocessing volumes — their effects only download when a volume is active.
- Reduce draw calls: combine meshes, instance repeated objects, minimize unique materials.
- **Don't pre-shrink textures.** With automatic progressive texture LODs, a 4K texture only loads at
  full resolution when the viewer is close *and* the device supports it — otherwise a lower-res LOD
  loads. Keep the source resolution (cap it via the per-texture max-resolution setting in Unity/Blender
  if you truly need to) rather than manually downsizing.
- Profile with browser DevTools + the Needle Inspector.

## Development vs production
Development builds are uncompressed and fast; compression only applies to **production builds**.
Docs: <https://engine.needle.tools/docs/how-to-guides/optimization/production-build-settings>

Full overview: <https://engine.needle.tools/docs/how-to-guides/optimization/>
