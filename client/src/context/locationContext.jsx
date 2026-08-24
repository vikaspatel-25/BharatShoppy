import { createContext, useContext, useState } from "react";

const LocationContext = createContext(null);

function LocationProvider({ children }) {
  const [selectedLocation, setSelectedLocation] = useState(null);

  return (
    <LocationContext.Provider
      value={{ selectedLocation, setSelectedLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

function useLocation() {
  return useContext(LocationContext);
}

export { LocationProvider, useLocation };