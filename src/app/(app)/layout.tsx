import { Suspense } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { SearchPalette } from "@/components/shell/search-palette";
import { UserMenu } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <SearchPalette />
          <div className="ml-auto">
            <Suspense fallback={<Skeleton className="h-8 w-40" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
