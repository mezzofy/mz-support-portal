/**
 * Logo — Support Console
 * Fixed Mezzofy brand mark (this is an internal staff tool — no per-merchant branding).
 */
import { cn } from '../utils/cn'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
}

export function Logo({ className, size = 'md' }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex items-center justify-center rounded-lg bg-orange-600', sizeClasses[size])}
        style={{ aspectRatio: '1/1' }}
      >
        <span className="text-white font-bold text-lg">M</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-bold text-gray-900 text-lg">Mezzofy</span>
        <span className="text-[11px] font-medium text-orange-600 -mt-0.5">Support</span>
      </div>
    </div>
  )
}
