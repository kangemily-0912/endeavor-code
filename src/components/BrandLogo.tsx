import logoAsset from "@/assets/event-spark-logo.png.asset.json";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={logoAsset.url}
      alt="Event Spark"
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}