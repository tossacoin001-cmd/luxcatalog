import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center text-[10px] tracking-[0.15em] uppercase px-3 py-1',
  {
    variants: {
      variant: {
        gold: 'border border-lux-gold text-lux-gold bg-transparent',
        'gold-filled': 'bg-lux-gold text-lux-bg',
        dark: 'bg-lux-surface border border-lux-border text-lux-text-muted',
        available: 'bg-lux-available/10 border border-lux-available/30 text-lux-available',
        under_offer: 'bg-lux-under-offer/10 border border-lux-under-offer/30 text-lux-under-offer',
        sold: 'bg-lux-sold/10 border border-lux-sold/30 text-lux-sold',
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
