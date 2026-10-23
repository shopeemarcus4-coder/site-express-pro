import { cn } from "@/lib/utils";

/** Wordmark "site express" with the yellow underline stroke (Handbook §6). */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-col leading-[0.82] font-display font-extrabold italic tracking-tight text-foreground",
        className,
      )}
      aria-label="Site Express"
    >
      <span aria-hidden className="text-[1.05em]">
        site
      </span>
      <span aria-hidden className="text-[1.05em] -mt-[0.05em] pl-[0.05em]">
        express
      </span>
      <svg
        aria-hidden
        viewBox="0 0 100 10"
        className="absolute -bottom-[0.38em] left-[0.35em] h-[0.4em] w-[80%] text-brand"
        preserveAspectRatio="none"
      >
        <path
          d="M2 8 C 30 3, 65 1.5, 98 2.5"
          stroke="currentColor"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
