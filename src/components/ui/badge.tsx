import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center text-[11px] tracking-[0.15em] uppercase px-3 py-1',
  {
    variants: {
      variant: {
        gold: 'border border-lux-border2 text-lux-gold bg-transparent',
        'gold-filled': 'bg-lux-text text-lux-bg',
        dark: 'bg-lux-surface border border-lux-border text-lux-text-muted',
        available: 'bg-[#eaf1ec] border border-lux-available/40 text-lux-available',
        under_offer: 'bg-[#f3ecdc] border border-lux-under-offer/40 text-lux-under-offer',
        sold: 'bg-[#f4e6e2] border border-lux-sold/40 text-lux-sold',
      },
    },
    defaultVariants: { variant: 'gold' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      style={{ fontFamily: 'var(--font-inter)' }}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
