import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";
const KEY = "sx-theme";

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark');document.documentElement.dataset.theme=t}catch(e){}})();`;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  const setTheme = (t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  };
  return { theme, setTheme };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const btn = (t: Theme, label: string, Icon: typeof Sun) => (
    <button
      type="button"
      onClick={() => setTheme(t)}
      aria-pressed={theme === t}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-full transition-colors duration-200",
        theme === t ? "bg-surface text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-[17px]" strokeWidth={1.8} />
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-background/60 p-1 backdrop-blur", className)}
    >
      {btn("light", "Modo dia", Sun)}
      {btn("dark", "Modo noite", Moon)}
    </div>
  );
}
