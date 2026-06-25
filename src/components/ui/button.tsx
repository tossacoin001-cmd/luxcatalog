import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs tracking-[0.18em] uppercase font-inter transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none',
  {
    variants: {
      variant: {
        gold: 'bg-lux-gold text-lux-bg hover:bg-lux-gold-light active:scale-95',
        outline: 'border border-lux-gold text-lux-gold hover:bg-lux-gold hover:text-lux-bg active:scale-95',
        ghost: 'text-lux-text-muted hover:text-lux-text',
        dark: 'bg-lux-surface border border-lux-border text-lux-text hover:border-lux-gold-muted active:scale-95',
        cream: 'bg-lux-cream text-lux-bg hover:bg-lux-cream2 active:scale-95',
      },
      size: {
        sm: 'h-9 px-5 text-[10px]',
        md: 'h-11 px-7',
        lg: 'h-13 px-10 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'gold',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{ fontFamily: 'var(--font-inter)', ...props.style }}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
