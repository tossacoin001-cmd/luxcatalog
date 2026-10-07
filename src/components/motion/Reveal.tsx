'use client'

import { MotionConfig, motion } from 'framer-motion'

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

// Wrap the app once. reducedMotion="user" makes framer-motion drop all
// transform/movement for visitors whose device asks for reduced motion,
// keeping only opacity fades, without any server/client markup difference.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

type RevealProps = {
  children: React.ReactNode
  className?: string
  delay?: number
  // Distance travelled upward while fading in. Small on purpose: content
  // should settle into place, not fly in.
  y?: number
}

// Fades + lifts content into place the first time it scrolls into view.
export default function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay }}
    >
      {children}
    </motion.div>
  )
}

// Staggers children: wrap a grid, give each item <RevealItem>.
export function RevealGroup({ children, className, stagger = 0.08 }: { children: React.ReactNode; className?: string; stagger?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 28 },
        show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_OUT_EXPO } },
      }}
    >
      {children}
    </motion.div>
  )
}
