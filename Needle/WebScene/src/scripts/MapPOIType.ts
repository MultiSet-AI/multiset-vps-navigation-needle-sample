// Kind of place a MapPOI represents, for the Unity Inspector dropdown.
// Copy this file alongside MapPOI.ts into web/src/scripts/.
//
// Values and order match MapPOIType in @multisetai/vps/navigation and POIType in the MultiSet
// Unity SDK, so a scene migrating from the Unity navigation demo keeps its selections.
//
// KEEP IN SYNC with MapPOIType.cs (same members, same numbers). The enum is declared here
// rather than re-exported from the package because Needle's component compiler is only
// confirmed to resolve enums declared in your own scripts folder — the same reason MapType.ts
// exists as a local file.
export enum MapPOIType {
    Room = 0,
    VendingMachine = 1,
    Exit = 2,
    Staircase = 3,
    Toilet = 4,
    FoodArea = 5,
    Information = 6,
    BookShelf = 7,
    Safety = 8,
    Elevator = 9,
    Printer = 10,
    Kitchen = 11,
    Outdoor = 12,
    Parking = 13,
    Other = 14,
}
