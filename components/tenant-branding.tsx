import { pickForeground } from "@/lib/validators/contrast";

export function tenantInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export interface TenantHeaderProps {
  name: string;
  logoUrl: string | null;
  accentColor: string;
  subtitle?: string;
  size?: "md" | "lg";
}

export function TenantHeader({
  name,
  logoUrl,
  accentColor,
  subtitle,
  size = "md",
}: TenantHeaderProps) {
  const fg = pickForeground(accentColor);
  const boxClass = size === "lg" ? "h-24 w-24 text-3xl" : "h-14 w-14 text-xl";
  const textClass =
    size === "lg" ? "text-3xl font-semibold" : "text-xl font-semibold";

  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className={`${boxClass} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${boxClass} flex items-center justify-center rounded-full font-semibold tracking-wide`}
          style={{ backgroundColor: accentColor, color: fg }}
          aria-hidden="true"
        >
          {tenantInitials(name)}
        </div>
      )}
      <div className="flex flex-col">
        <span className={textClass}>{name}</span>
        {subtitle ? (
          <span className="text-sm text-slate-600">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}
