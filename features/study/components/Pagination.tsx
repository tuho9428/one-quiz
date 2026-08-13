"use client";

import { getStudyItemsPageWindow } from "../sets/selection";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, ariaLabel = "Pages" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageWindow = getStudyItemsPageWindow(safePage, totalPages);
  const buttonClass = "min-h-10 rounded-xl border border-[#b9cfca] px-3 py-2 font-semibold text-[#24564e] hover:bg-[#e8f1ee] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]";

  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1} className={buttonClass}>Previous</button>
      <div className="flex items-center gap-1 sm:hidden" aria-label={`Page ${safePage} of ${totalPages}`}>
        {pageWindow.map((page) => <PageButton key={page} page={page} currentPage={safePage} onSelect={onPageChange} />)}
      </div>
      <div className="hidden flex-wrap items-center gap-1 sm:flex" aria-label={`Page ${safePage} of ${totalPages}`}>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <PageButton key={page} page={page} currentPage={safePage} onSelect={onPageChange} />)}
      </div>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} className={buttonClass}>Next</button>
    </nav>
  );
}

function PageButton({ page, currentPage, onSelect }: { page: number; currentPage: number; onSelect: (page: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(page)}
      aria-current={currentPage === page ? "page" : undefined}
      aria-label={`Go to page ${page}`}
      className={`min-h-10 min-w-10 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${currentPage === page ? "bg-[#0f766e] text-white dark:bg-[#2dd4bf] dark:text-[#10221f]" : "border border-[#b9cfca] text-[#24564e] hover:bg-[#e8f1ee] dark:border-[#3b5a54] dark:text-[#b8e4da] dark:hover:bg-[#20332f]"}`}
    >
      {page}
    </button>
  );
}
