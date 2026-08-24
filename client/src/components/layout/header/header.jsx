import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import LocationSelector from "./locationSelector";
import GlobalSearch from "./globalSearch";

function Header() {
  const [accountOpen, setAccountOpen] = useState(false);

  const accountRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggleAccount() {
    setAccountOpen((current) => !current);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex h-full shrink-0 items-center sm:w-44">
          {/* Mobile Logo */}
          <span className="text-2xl font-bold tracking-tight sm:hidden">
            <span className="text-orange-500">B</span>
            <span className="text-blue-900">S</span>
          </span>

          {/* Desktop Logo */}
          <span className="hidden text-2xl font-bold tracking-tight sm:inline">
            <span className="text-orange-500">Bharat</span>
            <span className="text-blue-900">Shoppy</span>
          </span>
        </div>

        {/* Location */}
        <LocationSelector />

        {/* Global Search */}
        <GlobalSearch />

        {/* Account */}
        <div ref={accountRef} className="relative shrink-0">
          <Button
            variant="outline"
            className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 bg-white px-2 text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 sm:h-11 sm:gap-2 sm:px-4"
            onClick={toggleAccount}
            aria-label="Account"
          >
            <UserRound className="h-[17px] w-[17px] sm:h-[18px] sm:w-[18px]" />

            <span className="hidden text-sm font-medium sm:inline">
              Account
            </span>

            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
          </Button>

          {accountOpen && (
            <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:top-14">
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Sign in
              </button>

              <button
                type="button"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Create account
              </button>

              <div className="my-1 h-px bg-slate-100" />

              <button
                type="button"
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                My orders
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
