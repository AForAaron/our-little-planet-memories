type BrandIconProps = {
  className?: string;
  title?: string;
  variant?: "logo" | "hero";
};

export function BrandIcon({ className, title, variant = "logo" }: BrandIconProps) {
  return (
    <img
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      className={className}
      decoding="async"
      height={variant === "hero" ? 760 : 88}
      src={variant === "hero" ? "/brand/donut-planet.png" : "/brand/donut-planet-192.png"}
      width={variant === "hero" ? 1100 : 128}
    />
  );
}
