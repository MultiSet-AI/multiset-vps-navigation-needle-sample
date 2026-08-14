# Needle MCP Server & Search API Reference

Two ways to reach Needle's knowledge base and tooling from an agent:

1. **Needle MCP Server** — full tool set (docs search, project files, live scene inspection). Requires setup.
2. **Search HTTP API** — docs search only, no setup, works from any shell with `curl`.

Prefer MCP when it's connected. Fall back to the HTTP API when it isn't.

---

## Search HTTP API

Public endpoint at `https://search.needle.tools`. Indexes Needle Engine documentation, the API reference, the community forum, Discord, and Needle source code. No API key needed.

Full reference, including endpoints not covered here: **https://search.needle.tools/api-docs**

### Semantic search

```bash
curl -s -H "Accept: application/json" \
  "https://search.needle.tools/api/semantic-search?q=how+to+add+a+rigidbody&limit=5"
```

Embedding-ranked results with content — no LLM in the loop, so it's fast and returns the source text verbatim.

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `q` | — | required | The query. Full natural-language questions work better than keywords. |
| `limit` | `10` | 1–20 | Number of results. |
| `max_chars` | `2000` | 200–10000 | Max characters of content per result. |

Response:

```json
{
  "query": "how to add a rigidbody",
  "results": [
    {
      "type": "message",
      "score": 0.94,
      "title": "Needle Engine Docs",
      "source": "Needle Engine Docs",
      "content": "## Rigidbodies\n\nRigidbodies add physics simulation to objects...",
      "contentLength": 750,
      "truncated": true,
      "url": "https://engine.needle.tools/docs/how-to-guides/scripting/use-physics.html#:~:text=...",
      "timestamp": "2026-03-05T14:57:40.000Z"
    }
  ],
  "durationMs": 2828
}
```

`url` carries a `#:~:text=` text fragment pointing at the exact passage — pass it through to the user so they can jump straight to it. When `truncated` is `true`, re-request with a higher `max_chars` or open the `url`.

### Ask (LLM answer with sources)

```bash
curl -s -X POST "https://search.needle.tools/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "how do I sync a transform in multiplayer?"}'
```

Returns `{ answer, sources, usage }`. Optional `messages` array for follow-up turns. Send `Accept: text/event-stream` to stream.

Prefer `/api/semantic-search` when you're the one reasoning over the results — you get the raw source material without a second model's summary in between.

### Limits & auth

- Unauthenticated: **10 requests/minute per IP**. Exceeding it returns `429` with a `Retry-After` header.
- A Bearer token lifts the rate limit: `-H "Authorization: Bearer <token>"`.
- `GET /api/v1/search` is deprecated — it 301-redirects to `/api/semantic-search`. Don't write new code against it.

### Plain-markdown docs

Any documentation page is available as markdown — swap `.html` for `.md`:

```
https://engine.needle.tools/docs/how-to-guides/scripting/use-physics.md
```

Whole-corpus context files: [llms.txt](https://cloud.needle.tools/llms.txt) (compact) and [llms-full.txt](https://cloud.needle.tools/llms-full.txt) (complete).

---

## Needle MCP Server

Ships with the `needle-cloud` npm package. Two connection modes, same tools:

```bash
npx needle-cloud mcp      # stdio — the client spawns the process
npx needle-cloud start    # local HTTP server on localhost:8424
```

Use the local HTTP server when you also want live scene access — the Needle Inspector and the Unity/Blender integrations connect to it. If Needle Engine for Unity or Blender is running, that server is usually already up.

Client config for stdio mode:

```json
{
  "mcpServers": {
    "needle": {
      "command": "npx",
      "args": ["-y", "needle-cloud", "mcp"]
    }
  }
}
```

For HTTP mode, point the client at `http://localhost:8424/mcp` with transport `http`. Per-client setup instructions (Claude Desktop, Codex CLI, VS Code, Cursor, Antigravity) are at https://engine.needle.tools/docs/ai/needle-mcp-server.

### Always-available tools

| Tool | What it does |
|------|--------------|
| `needle_search` | Semantic search over docs, forum, Discord, and source. Same corpus as the HTTP API. |
| `load_needle_engine_skill` | Loads this skill's guidelines and API references. |
| `needle_cloud_me` | Current Needle Cloud user and team. |
| `files_editor_project_path` | Path to the open Unity or Blender project. |
| `files_editor_scene_path` | Path to the open scene. |
| `files_web_project_path` | Path to the Needle Engine web project directory. |
| `files_editor_log_path` | Path to the Unity/Blender editor log. |
| `files_read` | Read a file from the editor or web project, with line range and text filter. |
| `files_grep` | Regex search across project files, with glob and result limit. |
| `files_list` | List project files by glob, optionally recursive. |
| `files_read_editor_log` | Read or keyword-search the editor log. |
| `files_read_gltf` | Summarize a glTF/GLB — nodes, meshes, materials, animations, extensions. Supports JSON pointer queries. |

`files_*` tools resolve paths relative to the editor and web projects the server knows about, so they work even when the agent's working directory is somewhere else. `files_read_gltf` beats reading a `.glb` as bytes — use it to answer "what's actually in this scene file".

### Live scene tools (Needle Inspector)

Available when the [Needle Inspector](https://engine.needle.tools/docs/three/needle-devtools-for-threejs-chrome-extension) Chrome extension is open on a running page and connected to the local server. These act on the **live scene in the browser** — reads reflect current runtime state, and `inspector_property_setValue` changes appear instantly.

| Tool | What it does |
|------|--------------|
| `inspector_hierarchy_search_nodes` | Find objects in the live scene graph by name or type. |
| `inspector_hierarchy_select_node` | Select an object (also drives the Inspector UI). |
| `inspector_get_selected_object` | Read the current selection. |
| `inspector_component_search` | Find components in the running scene. |
| `inspector_property_find` / `inspector_property_read` | Locate and read properties on objects, components, and materials. |
| `inspector_property_setValue` | Write a property — applied live. |
| `inspector_get_edits` | Pull edits made by hand in the Inspector, so you can apply them to source code. |
| `inspector_actions_property_whoCalls` | Trace what code writes a given property. |
| `inspector_code_read` | Read the page's loaded source. |
| `inspector_console_read` | Read the browser console. |
| `inspector_gltf_read` / `inspector_nodegraph_read` | Inspect loaded glTF assets and node graphs. |
| `inspector_assets_search_asset` / `inspector_assets_read_details` / `inspector_assets_read_options` | Search and inspect assets. |
| `inspector_resources_list` / `inspector_get_website_resource_info` | Enumerate loaded resources and their sizes. |
| `inspector_measure_website_performance` / `inspector_gpu_timing_profile` | Measure runtime and GPU performance. |
| `inspector_get_current_website` / `inspector_fetch_website` / `inspector_read_website_content` | Read the current page or fetch another. |
| `inspector_open_external_resource` | Open a resource externally. |
| `inspector_get_current_time` | Current time from the Inspector's context. |

The `inspector_get_edits` → apply-to-source loop is the high-value one: the user tweaks a material or transform in the browser, you read the edits and make them permanent in the project files.

> MCP/AI editing via the Inspector requires **Needle Inspector Pro** (one-time purchase, included with Needle Engine Pro). Read-only docs search and `files_*` tools do not.

### Unity tools

| Tool | What it does |
|------|--------------|
| `unity_get_selected_objects` | Read the current Unity selection. |

### Blender tools

Registered by the [Needle Blender add-on](https://engine.needle.tools/docs/blender/) when it's running. These act on the **live Blender session** — writes show up in the viewport immediately.

| Tool | What it does |
|------|--------------|
| `blender_search_hierarchy` | Return the scene hierarchy tree — names, types, parent/child relationships. Filter by name pattern or object type. |
| `blender_get_object_details` | Detail for one object by name: transform, mesh stats, materials with shader info, modifiers, constraints, visibility, Needle components. |
| `blender_get_selected_objects` | Current selection — names, types, optionally full details. |
| `blender_select_object` | Select one or more objects by name; optionally deselect others and set the active object. |
| `blender_add_component` | Add a Needle component to an object, optionally with initial property values. |
| `blender_set_component_property` | Set properties on a component that already exists and is active on the object. |
| `blender_set_object_transform` | Set position/rotation/scale. Only provided fields change. |
| `blender_get_scene_settings` | Read Needle scene settings as flat key/value pairs using Blender property names. |
| `blender_set_scene_settings` | Write scene settings. Call `blender_get_scene_settings` first to see current values. |

Scene settings matter more than they look: they control which components are **implicitly added during export** (compression, XR, networking, rendering). If an exported GLB has components nobody authored, check these.

---

## Which tool for which question

| Question | Reach for |
|----------|-----------|
| "How do I do X in Needle Engine?" | `needle_search` → HTTP API fallback |
| "What's the exact signature of `Y`?" | `scripts/lookup-api.mjs` against the installed `.d.ts` files |
| "Why is my scene doing Z right now?" | Inspector tools (live state), or `node_modules/.needle/logs/` |
| "What's in this GLB?" | `files_read_gltf` |
| "Why is it slow?" | `inspector_measure_website_performance`, `inspector_gpu_timing_profile` |
