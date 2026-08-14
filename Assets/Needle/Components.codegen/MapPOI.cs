// NEEDLE_CODEGEN_START
// auto generated code - do not edit directly

#pragma warning disable

namespace Needle.Typescript.GeneratedComponents
{
	public partial class MapPOI : UnityEngine.MonoBehaviour
	{
		[UnityEngine.Tooltip("Name shown in the destination list and on the label.")]
		public string @poiName = "";
		[UnityEngine.Tooltip("Stable id used by navigation.setDestination(). Leave empty to use the GameObject name. Set it explicitly if you rename objects, or if two POIs share a name.")]
		public string @poiId = "";
		[UnityEngine.Tooltip("Kind of place. Used to pick an icon; navigation treats every type the same.")]
		public Needle.Typescript.GeneratedComponents.MapPOIType @poiType = Needle.Typescript.GeneratedComponents.MapPOIType.Room;
		[UnityEngine.Tooltip("Metres from this POI that count as arrival. 0 = use the value on MultisetNavigation.")]
		public float @arrivalRadius = 0f;
		[UnityEngine.Tooltip("Optional longer text, for your own UI to display.")]
		public string @description = "";
	}
}

// NEEDLE_CODEGEN_END