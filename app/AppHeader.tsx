import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#d5e2df] bg-[#f3f6f5]/95 backdrop-blur dark:border-[#2d4440] dark:bg-[#101817]/95">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-[#16322e] dark:text-[#edf5f1]">
          One Quiz
        </Link>
        <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm font-semibold sm:gap-2">
          <NavLink href="/">Dashboard</NavLink>
          <NavLink href="/sets">Study Sets</NavLink>
          <NavLink href="/import">Import</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="shrink-0 rounded-lg px-3 py-2 text-[#35645c] transition hover:bg-[#e8f1ee] hover:text-[#0f766e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] dark:text-[#b8e4da] dark:hover:bg-[#20332f] dark:hover:text-[#5eead4]">{children}</Link>;
}
