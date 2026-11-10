// NEEDLE_CODEGEN_START
// auto generated code - do not edit directly

#pragma warning disable

namespace Needle.Typescript.GeneratedComponents
{
	public partial class MultisetVPS : UnityEngine.MonoBehaviour
	{
		[UnityEngine.Tooltip("Client ID. Ends up in the page source, so use for prototyping only.")]
		public string @clientId = "";
		[UnityEngine.Tooltip("Client secret. Ends up in the page source, so use for prototyping only.")]
		public string @clientSecret = "";
		[UnityEngine.Tooltip("URL of your own backend endpoint that returns a MultiSet token as JSON with token and expiresOn. Keeps the client secret off the page. Takes precedence over clientId / clientSecret.")]
		public string @tokenUrl = "";
		[UnityEngine.Tooltip("For SingleMap / MapSet: the map or map-set code. For ObjectTracking: comma-separated object codes (e.g. 'obj1,obj2').")]
		public string @mapCode = "";
		public Needle.Typescript.GeneratedComponents.MapType @mapType = Needle.Typescript.GeneratedComponents.MapType.SingleMap;
		[UnityEngine.Tooltip("Overlay the scanned map mesh after localization (VPS modes only).")]
		public bool @showMesh = true;
		[UnityEngine.Tooltip("Load the map mesh as an invisible occluder so virtual content behind real walls is hidden (VPS modes only). Takes precedence over showMesh - the mesh itself is not drawn.")]
		public bool @occlusion = false;
		[UnityEngine.Tooltip("For a versioned map, show the newest active scan's mesh instead of the base scan's (VPS modes).")]
		public bool @useActiveMapVersion = false;
		[UnityEngine.Tooltip("Show a coordinate-axis gizmo at the map origin after localization (VPS modes only).")]
		public bool @showGizmo = true;
		[UnityEngine.Tooltip("Load and render a 3D outline mesh for each detected object (OT mode only).")]
		public bool @showObjectMeshes = false;
		[UnityEngine.Tooltip("Run one localization automatically when the AR session starts (VPS modes).")]
		public bool @autoLocalize = true;
		[UnityEngine.Tooltip("Re-localize whenever XR tracking is lost and then recovered.")]
		public bool @relocalization = false;
		[UnityEngine.Tooltip("Continuously send localization requests in the background while the session is active.")]
		public bool @backgroundLocalization = false;
		[UnityEngine.Tooltip("Seconds between background localization attempts (10–180). 0 = SDK default (30 s).")]
		public float @bgLocalizationInterval = 0f;
		[UnityEngine.Tooltip("Reject results below confidenceThreshold when enabled.")]
		public bool @confidenceCheck = false;
		[UnityEngine.Tooltip("Minimum confidence to accept (0.2–0.8). Only used when confidenceCheck is true.")]
		public float @confidenceThreshold = 0.5f;
		[UnityEngine.Tooltip("Max ms to wait for a valid viewer pose before failing. 0 = SDK default (10 000 ms).")]
		public float @poseTimeoutMs = 0f;
		[UnityEngine.Tooltip("Retry a missed or low-confidence VPS-1 query once with VPS-2 deep search, on the same frame.")]
		public bool @queryModeFallback = false;
		[UnityEngine.Tooltip("After a fix, send the device position as the hint for later queries (within hintRadius, default 25 m).")]
		public bool @useLastPoseAsHint = false;
		[UnityEngine.Tooltip("Silently retry a failed first localization of the session (up to 5 times) before reporting it.")]
		public bool @firstLocalizationUntilSuccess = false;
		[UnityEngine.Tooltip("Capture several frames per localization and query them together: more robust, slower.")]
		public bool @multiFrame = false;
		[UnityEngine.Tooltip("Frames per multi-frame localization (4–6). 0 = SDK default (4).")]
		public float @multiFrameCount = 0f;
		[UnityEngine.Tooltip("Ms between multi-frame captures (400–800). 0 = SDK default (500).")]
		public float @multiFrameIntervalMs = 0f;
		[UnityEngine.Tooltip("Request geographic coordinates in the localization response.")]
		public bool @convertToGeoCoordinates = false;
		[UnityEngine.Tooltip("Send a Geolocation API hint with each request to narrow the search area.")]
		public bool @passGeoPose = false;
		[UnityEngine.Tooltip("Ignore altitude when filtering by geo position. Only valid when passGeoPose is enabled.")]
		public bool @use2DFiltering = false;
		[UnityEngine.Tooltip("Local-space position hint 'x,y,z' to narrow the search area (optional).")]
		public string @hintPosition = "";
		[UnityEngine.Tooltip("Search radius in metres (5–100) around hintPosition. 0 = server default (25 m).")]
		public float @hintRadius = 0f;
		[UnityEngine.Tooltip("Comma-separated map codes to restrict search (map-set mode only).")]
		public string @hintMapCodes = "";
		[UnityEngine.Tooltip("Use the VPS-2 deep search engine for every query: up to 15% higher recall, about 2 s per query.")]
		public bool @deepSearch = false;
		[UnityEngine.Tooltip("How far the search reaches inside the map, 1–5. 0 = server default (1). Raise only for large maps.")]
		public float @searchDepth = 0f;
		[UnityEngine.Tooltip("Run object detection automatically when the AR session starts (OT mode).")]
		public bool @autoTracking = false;
		[UnityEngine.Tooltip("Re-attempt tracking when XR tracking is lost and recovered (OT mode).")]
		public bool @restartTracking = false;
		[UnityEngine.Tooltip("Ms to wait before capturing a frame for tracking (camera stabilisation).")]
		public float @trackingCaptureDelayMs = 0f;
		public void Awake() {}
		public void Start() {}
		public void OnDestroy() {}
	}
}

// NEEDLE_CODEGEN_END