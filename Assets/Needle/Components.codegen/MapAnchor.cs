// NEEDLE_CODEGEN_START
// auto generated code - do not edit directly

#pragma warning disable

namespace Needle.Typescript.GeneratedComponents
{
	public partial class MapAnchor : UnityEngine.MonoBehaviour
	{
		[UnityEngine.Tooltip("Position offset from the map origin in metres. When isRightHanded is false (default): supply Unity Inspector values directly — X will be negated automatically. When isRightHanded is true: supply Three.js values as-is (no conversion).")]
		public UnityEngine.Vector3 @offset = new UnityEngine.Vector3(0f, 0f, 0f);
		[UnityEngine.Tooltip("Match the map's orientation. Disable to keep the object's original rotation.")]
		public bool @matchOrientation = true;
		[UnityEngine.Tooltip("Extra rotation applied on top of the map orientation. When isRightHanded is false (default): supply Unity Inspector values directly — Y and Z are negated automatically. When isRightHanded is true: supply Three.js values as-is (no conversion). Only applied when matchOrientation is true.")]
		public UnityEngine.Vector3 @rotationOffset = new UnityEngine.Vector3(0f, 0f, 0f);
		[UnityEngine.Tooltip("Set to true if offset and rotationOffset are already in Three.js (right-handed) space — no conversion is applied. Leave false (default) to enter values in Unity (left-handed) space: X in position and Y/Z in rotation are negated automatically.")]
		public bool @isRightHanded = false;
		[UnityEngine.Tooltip("Hide until the first localization. Re-hides on session end.")]
		public bool @hideUntilLocalized = true;
		public void Awake() {}
		public void OnDestroy() {}
		public void connectAdapter(object @adapter) {}
		public void applyLocalization(object @result, UnityEngine.Matrix4x4 @worldFromMap) {}
	}
}

// NEEDLE_CODEGEN_END