/**
 * TicketPriorityBadge — Support Console
 */
import { useTranslation } from 'react-i18next'
import { TicketPriority } from '../../../../domain/entities/support-ticket.entity'
import { cn } from '../../../../shared/utils/cn'

const PRIORITY_CLASSES: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'bg-gray-100 text-gray-600',
  [TicketPriority.MEDIUM]: 'bg-blue-100 text-blue-700',
  [TicketPriority.HIGH]: 'bg-orange-100 text-orange-700',
  [TicketPriority.URGENT]: 'bg-red-100 text-red-800',
}

interface Props {
  priority: TicketPriority
}

export function TicketPriorityBadge({ priority }: Props) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        PRIORITY_CLASSES[priority],
      )}
    >
      {t(`support.priority.${priority}`)}
    </span>
  )
}
