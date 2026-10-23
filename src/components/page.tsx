import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl space-y-6 p-6", className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon}
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{children}</h3>
      {actions}
    </div>
  )
}
