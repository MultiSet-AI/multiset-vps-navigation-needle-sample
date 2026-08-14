// NEEDLE_CODEGEN_START
// auto generated code - do not edit directly

#pragma warning disable

namespace Needle.Typescript.GeneratedComponents
{
	public partial class MultisetVPS : UnityEngine.MonoBehaviour
	{
		public string @clientId = "";
		public string @clientSecret = "";
		[UnityEngine.Tooltip("For SingleMap / MapSet: the map or map-set code. For ObjectTracking: comma-separated object codes (e.g. 'obj1,obj2').")]
		public string @mapCode = "";
		public Needle.Typescript.GeneratedComponents.MapType @mapType = Needle.Typescript.GeneratedComponents.MapType.SingleMap;
		[UnityEngine.Tooltip("Overlay the scanned map mesh after localization (VPS modes only).")]
		public bool @showMesh = true;
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
		[UnityEngine.Tooltip("Request geographic coordinates in the localization response.")]
		public bool @convertToGeoCoordinates = false;
		[UnityEngine.Tooltip("Send a Geolocation API hint with each request to narrow the search area.")]
		public bool @passGeoPose = false;
		[UnityEngine.Tooltip("Ignore altitude when filtering by geo position. Only valid when passGeoPose is enabled.")]
		public bool @use2DFiltering = false;
		[UnityEngine.Tooltip("Local-space position hint 'x,y,z' to narrow the search area (optional).")]
		public string @hintPosition = "";
		[UnityEngine.Tooltip("Search radius in metres around hintPosition. 0 = no hint.")]
		public float @hintRadius = 0f;
		[UnityEngine.Tooltip("Comma-separated map codes to restrict search (map-set mode only).")]
		public string @hintMapCodes = "";
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