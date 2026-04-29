import { cn } from "@/lib/utils";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex min-w-0 items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(55,119,197,0.22),transparent_32%),linear-gradient(135deg,rgba(55,119,197,0.10),rgba(246,241,232,0.70))]" />
        <svg
          viewBox="0 0 40 40"
          aria-hidden="true"
          className="relative h-7 w-7 text-primary"
          fill="none"
        >
          <path
            d="M12 11.5h16L12.8 28.5H28"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.2"
          />
          <path
            d="M28 11.5c2.4 1.3 4 3.5 4 6.1 0 4.8-5.4 8.7-12 8.7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
            opacity="0.45"
          />
          <circle cx="30.5" cy="10.5" r="2" fill="currentColor" />
        </svg>
      </div>

      <div className={cn("min-w-0 leading-none", compact ? "hidden sm:block" : "block")}>
        <div className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
          ZERRT<span className="mx-1 text-muted-foreground">·</span>
          <span className="text-primary">Ai</span>
        </div>
        <div className="mt-1 hidden text-[11px] uppercase tracking-[0.24em] text-muted-foreground sm:block">
          Creative Workspace
        </div>
      </div>
    </div>
  );
}
