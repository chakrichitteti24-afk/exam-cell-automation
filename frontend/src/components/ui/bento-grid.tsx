import React from "react";
import { cn } from "@/lib/utils";

/* ─── BentoGrid ────────────────────────────────────────────────────────────── */

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}

export function BentoGrid({
  children,
  className,
  cols = 4,
  ...props
}: BentoGridProps) {
  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid gap-4 md:gap-5 auto-rows-[minmax(170px,auto)]",
        colClasses[cols],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── BentoCard ────────────────────────────────────────────────────────────── */

interface BentoCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  children?: React.ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function BentoCard({
  children,
  className,
  colSpan = 1,
  rowSpan = 1,
  title,
  subtitle,
  icon,
  badge,
  ...props
}: BentoCardProps) {
  const colSpanClass = {
    1: "col-span-1",
    2: "col-span-1 md:col-span-2 xl:col-span-2",
    3: "col-span-1 md:col-span-2 xl:col-span-3",
    4: "col-span-1 md:col-span-2 xl:col-span-4",
  }[colSpan];

  const rowSpanClass = {
    1: "row-span-1",
    2: "row-span-1 xl:row-span-2",
  }[rowSpan];

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl bg-white/60 backdrop-blur-xl border-white/60 border border-slate-200/90 p-5 md:p-6",
        "shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200",
        colSpanClass,
        rowSpanClass,
        className
      )}
      {...props}
    >
      {/* Card Header */}
      {(title || subtitle || icon || badge) && (
        <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-105 duration-200">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="font-bold text-sm tracking-tight text-slate-900 truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}

      {/* Card Body */}
      <div className="flex-1 flex flex-col justify-between">{children}</div>
    </div>
  );
}
