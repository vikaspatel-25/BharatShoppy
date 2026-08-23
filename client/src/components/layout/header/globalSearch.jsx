import { Search } from "lucide-react";
import { useEffect, useState, useRef } from "react";
function GlobalSearch() {
  return (
    <div className="group flex h-10 min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 transition-all duration-200 focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm sm:h-11">
      <Search className="ml-2.5 h-[17px] w-[17px] shrink-0 text-slate-400 transition-colors group-focus-within:text-slate-600 sm:ml-3.5 sm:h-[18px] sm:w-[18px]" />

      <input
        type="search"
        placeholder="Search products or stores..."
        aria-label="Search products or stores"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:px-3"
      />
    </div>
  );
}

export default GlobalSearch;