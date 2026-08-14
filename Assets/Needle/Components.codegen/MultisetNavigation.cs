// NEEDLE_CODEGEN_START
// auto generated code - do not edit directly

#pragma warning disable

namespace Needle.Typescript.GeneratedComponents
{
	public partial class MultisetNavigation : UnityEngine.MonoBehaviour
	{
		[UnityEngine.Tooltip("The baked navmesh surface. Must be nested under the MapSpace root.")]
		public UnityEngine.Transform @navMesh;
		[UnityEngine.Tooltip("Show the walkable surface as a green overlay. Use it to find gaps and T-junctions.")]
		public bool @showNavMeshDebug = false;
		[UnityEngine.Tooltip("Arrow texture tiled along the path. Leave empty for a plain glowing strip.")]
		public UnityEngine.Texture @arrowTexture;
		public UnityEngine.Color @pathColor = new UnityEngine.Color(0.2f, 0.8f, 1f, 1f);
		[UnityEngine.Tooltip("Ribbon width in metres.")]
		public float @pathWidth = 0.35f;
		[UnityEngine.Tooltip("Metres above the floor. Raise it if the ribbon flickers against the floor.")]
		public float @pathHeightAboveFloor = 0.1f;
		[UnityEngine.Tooltip("Radius used to round off corners, in metres. 0 gives sharp corners. Sharp corners make arrows look bent, because the joint is a trapezoid rather than a rectangle; rounding spreads that shear over a short arc.")]
		public float @pathCornerRadius = 0.4f;
		[UnityEngine.Tooltip("Metres between the start of one arrow and the next. Controls the gap, not the arrow size.")]
		public float @arrowSpacing = 2f;
		[UnityEngine.Tooltip("Metres one arrow occupies along the path. 0 = match Path Width, which keeps a square texture undistorted. Raise it for longer arrows without changing how often they repeat.")]
		public float @arrowLength = 0f;
		[UnityEngine.Tooltip("Metres per second the arrows travel. Negative reverses them.")]
		public float @arrowScrollSpeed = 1f;
		[UnityEngine.Tooltip("Show a floating name label above each MapPOI.")]
		public bool @showPOILabels = true;
		[UnityEngine.Tooltip("Hide POI labels further away than this, in metres. 0 shows them all.")]
		public float @poiLabelMaxDistance = 40f;
		[UnityEngine.Tooltip("Mount the built-in destination picker and progress UI.")]
		public bool @useDefaultUI = true;
		[UnityEngine.Tooltip("Milliseconds between path recalculations.")]
		public float @recalcIntervalMs = 500f;
		[UnityEngine.Tooltip("Metres of movement that force an immediate recalculation.")]
		public float @repathMoveThreshold = 0.5f;
		[UnityEngine.Tooltip("Seconds off the walkable surface before navigation gives up.")]
		public float @invalidPathGraceSeconds = 10f;
		[UnityEngine.Tooltip("Metres from a POI that count as arrival. MapPOI can override this per place.")]
		public float @arrivalRadius = 1.5f;
		[UnityEngine.Tooltip("Metres to search for walkable ground near the viewer. Also separates floors: too large and the user snaps to the floor below.")]
		public float @navMeshSnapDistance = 4f;
		[UnityEngine.Tooltip("Invoked when navigation starts toward a destination.")]
		public UnityEngine.Events.UnityEvent @onNavigationStarted;
		[UnityEngine.Tooltip("Invoked when navigation stops without arriving.")]
		public UnityEngine.Events.UnityEvent @onNavigationStopped;
		[UnityEngine.Tooltip("Invoked on arrival at the destination.")]
		public UnityEngine.Events.UnityEvent @onArrived;
		public void Update() {}
		public void OnDestroy() {}
		public void showDestinations() {}
		public void hideDestinations() {}
		public void stopNavigation() {}
		public void navigateToNearest() {}
		public void toggleNavMeshDebug() {}
	}
}

// NEEDLE_CODEGEN_END