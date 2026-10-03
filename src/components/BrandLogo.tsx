import transparentLogo from "@/assets/event-spark-logo-transparent.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={transparentLogo}
      alt="Event Spark"
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}