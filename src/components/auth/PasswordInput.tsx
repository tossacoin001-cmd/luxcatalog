'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Password field with a show/hide toggle, so people can check what they
// typed (especially on phones). The toggle is a real button with a label
// and a state, and switching back always returns to hidden.
export default function PasswordInput({ className, style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${className ?? ''} pr-12`}
        style={style}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-11 transition-colors hover:text-lux-gold focus-visible:outline-none focus-visible:text-lux-gold"
        style={{ color: '#9a8f7a' }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </span>
  )
}
