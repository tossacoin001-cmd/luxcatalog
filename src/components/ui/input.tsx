import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          'w-full h-11 px-4 text-sm bg-lux-surface border border-lux-border text-lux-text placeholder:text-lux-text-subtle focus:outline-none focus:border-lux-gold-muted transition-colors',
          className
        )}
        style={{ fontFamily: 'var(--font-inter)' }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
