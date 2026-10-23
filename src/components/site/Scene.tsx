import { cn } from "@/lib/utils";
import sceneDay from "@/assets/scene-day.webp";
import sceneNight from "@/assets/scene-night.webp";

export function Scene({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("overflow-hidden", className)} aria-hidden="true">
      <img
        src={sceneDay}
        alt=""
        width={1200}
        height={896}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="scene-day absolute inset-0 size-full object-cover object-[70%_center]"
      />
      <img
        src={sceneNight}
        alt=""
        width={1200}
        height={896}
        loading={priority ? "eager" : "lazy"}
        className="scene-night absolute inset-0 size-full object-cover object-[70%_center]"
      />
    </div>
  );
}
