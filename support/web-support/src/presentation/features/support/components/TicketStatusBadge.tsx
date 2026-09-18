/**
 * TicketStatusBadge — Support Console
 */
import { useTranslation } from 'react-i18next'
import { TicketStatus } from '../../../../domain/entities/support-ticket.entity'
import { cn } from '../../../../shared/utils/cn'

const STATUS_CLASSES: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-green-100 text-green-800',
  [TicketStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [TicketStatus.PENDING_USER]: 'bg-yellow-100 text-yellow-800',
  [TicketStatus.PENDING_MERCHANT]: 'bg-orange-100 text-orange-800',
  [TicketStatus.RESOLVED]: 'bg-purple-100 text-purple-800',
  [TicketStatus.CLOSED]: 'bg-gray-100 text-gray-800',
  [TicketStatus.CANCELLED]: 'bg-red-100 text-red-800',
}

interface Props {
  status: TicketStatus
}

export function TicketStatusBadge({ status }: Props) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_CLASSES[status],
      )}
    >
      {t(`support.status.${status}`)}
    </span>
  )
}
