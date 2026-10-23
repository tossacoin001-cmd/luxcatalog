import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-xs tracking-[0.18em] uppercase font-inter transition-colors duration-300 disabled:pointer-events-none disabled:bg-[#d6cfbf] disabled:text-[#3a362d] disabled:border-[#c4bcaa] focus-visible:outline-none',
  {
    variants: {
      variant: {
        gold: 'bg-lux-text text-lux-bg hover:bg-[#3a362d] active:scale-[0.98]',
        outline: 'border border-lux-text text-lux-text hover:bg-lux-text hover:text-lux-bg active:scale-[0.98]',
        ghost: 'text-lux-text-muted hover:text-lux-text',
        dark: 'bg-lux-surface border border-lux-border text-lux-text hover:border-lux-text active:scale-[0.98]',
        cream: 'bg-lux-text text-lux-bg hover:bg-[#3a362d] active:scale-[0.98]',
      },
      size: {
        sm: 'h-11 px-5 text-[11px]',
        md: 'h-11 px-7',
        lg: 'h-13 px-10 text-xs',
        icon: 'h-11 w-11',
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
