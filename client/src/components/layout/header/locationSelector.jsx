import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  MapPin,
  Search,
} from "lucide-react";

function LocationSelector() {
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const locationRef = useRef(null);

  const recentLocations = [
    {
      id: 1,
      city: "Indore",
      state: "Madhya Pradesh",
    },
    {
      id: 2,
      city: "Bhopal",
      state: "Madhya Pradesh",
    },
  ];

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        locationRef.current &&
        !locationRef.current.contains(event.target)
      ) {
        setLocationOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setLocationOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    async function searchLocations() {
      const query = locationQuery.trim();

      if (!query) {
        setLocationResults([]);
        return;
      }

      try {
        setLocationLoading(true);

        const response = await fetch(
          `http://localhost:7002/searchLocations?q=${encodeURIComponent(
            query
          )}`
        );

        if (!response.ok) {
          throw new Error("Failed to search locations");
        }

        const data = await response.json();

        setLocationResults(data);
      } catch (error) {
        console.error("Location search failed:", error);
        setLocationResults([]);
      } finally {
        setLocationLoading(false);
      }
    }

    searchLocations();
  }, [locationQuery]);

  function toggleLocation() {
    setLocationOpen((current) => !current);
  }

  function handleCurrentLocation() {
    console.log("Request current location");

    // Browser Geolocation API will be connected later.
  }

  function selectLocation(location) {
    console.log("Selected location:", location);

    setSelectedLocation(location);
    setLocationQuery("");
    setLocationResults([]);
    setLocationOpen(false);
  }

  return (
    <div
      ref={locationRef}
      className="relative shrink-0"
    >
      {/* Desktop Location Button */}
      <button
        type="button"
        onClick={toggleLocation}
        className="group hidden h-11 items-center gap-2 rounded-xl px-3 transition-all duration-200 hover:bg-slate-100 md:flex"
      >
        <MapPin className="h-[18px] w-[18px] text-slate-500 transition-colors group-hover:text-slate-800" />

        <div className="max-w-32 text-left leading-tight">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Shopping near
          </p>

          <div className="mt-0.5 flex items-center gap-1">
            <span className="truncate text-sm font-semibold text-slate-800">
              {selectedLocation?.city || "Select location"}
            </span>

            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
        </div>
      </button>

      {/* Mobile Location Button */}
      <button
        type="button"
        onClick={toggleLocation}
        aria-label={
          selectedLocation
            ? `Selected location: ${selectedLocation.city}`
            : "Select location"
        }
        className="flex h-10 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
      >
        <MapPin className="h-[18px] w-[18px]" />
      </button>

      {/* Location Panel */}
      {locationOpen && (
        <div
          className="
            absolute left-0 top-12 z-50
            w-[calc(100vw-16px)]
            max-w-80
            rounded-xl border border-slate-200
            bg-white p-4 shadow-xl
            sm:top-14 sm:w-80
          "
        >
          <p className="text-sm font-semibold text-slate-900">
            Choose your location
          </p>

          {/* Location Search */}
          <div className="mt-3 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 transition-colors focus-within:border-slate-300 focus-within:bg-white">
            <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />

            <input
              type="text"
              value={locationQuery}
              onChange={(event) =>
                setLocationQuery(event.target.value)
              }
              placeholder="Search city or area..."
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Current Location */}
          <button
            type="button"
            onClick={handleCurrentLocation}
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-left transition-colors hover:bg-slate-50"
          >
            <MapPin className="h-5 w-5 shrink-0 text-slate-600" />

            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                Use my current location
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                Allow location access
              </p>
            </div>
          </button>

          {/* Recent Locations */}
          {!locationQuery && (
            <>
              <div className="my-4 h-px bg-slate-100" />

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Recent locations
              </p>

              {recentLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => selectLocation(location)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {location.city}
                </button>
              ))}
            </>
          )}

          {/* Search Results */}
          {locationQuery && (
            <div className="mt-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search results
              </p>

              {locationLoading && (
                <p className="px-2 py-3 text-sm text-slate-400">
                  Searching...
                </p>
              )}

              {!locationLoading &&
                locationResults.length === 0 && (
                  <p className="px-2 py-3 text-sm text-slate-400">
                    No locations found.
                  </p>
                )}

              {!locationLoading &&
                locationResults.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => selectLocation(location)}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <p className="truncate text-sm font-medium text-slate-700">
                      {location.city}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {location.state}
                    </p>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationSelector;