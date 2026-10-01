import { useNavigate } from "react-router-dom";
import LocationSelector from "./locationSelector";
import GlobalSearch from "./globalSearch";

function Header() {
  const navigate = useNavigate();

  function goHome() {
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3.5 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          type="button"
          onClick={goHome}
          className="flex h-full shrink-0 cursor-pointer items-center transition-opacity hover:opacity-90 sm:w-44"
          aria-label="BharatShoppy Home"
        >
          {/* Mobile Logo: Brand Icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-base font-black text-white shadow-xs sm:hidden">
            B
          </div>

          {/* Desktop Logo: Icon + Wordmark */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-sm font-black text-white shadow-xs">
              B
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-orange-500">Bharat</span>
              <span className="text-blue-900">Shopy</span>
            </span>
          </div>
        </button>

       

        {/* Global Search */}
        <GlobalSearch />

        {/* Location */}
        <LocationSelector />
      </div>
    </header>
  );
}

export default Header;