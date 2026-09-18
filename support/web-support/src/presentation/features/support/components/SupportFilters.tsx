/**
 * SupportFilters — Support Console
 * Debounced search + status/type/priority/merchant + (queue only)
 * assignee/unassigned filters. Presentational; state lives in the viewmodel.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import {
  TicketStatus,
  TicketType,
  TicketPriority,
} from '../../../../domain/entities/support-ticket.entity'
import { useDebounce } from '../hooks/useDebounce'

export interface SupportFiltersProps {
  searchQuery: string
  statusFilter: string
  typeFilter: string
  priorityFilter: string
  merchantFilter: string
  assigneeFilter?: string
  unassignedOnly?: boolean
  showAssigneeControls?: boolean
  hasActiveFilters: boolean
  onSearch: (q: string) => void
  onStatus: (s: string) => void
  onType: (t: string) => void
  onPriority: (p: string) => void
  onMerchant: (m: string) => void
  onAssignee?: (a: string) => void
  onUnassigned?: (v: boolean) => void
  onClear: () => void
}

export function SupportFilters(props: SupportFiltersProps) {
  const { t } = useTranslation()

  // Local search state, debounced before propagating to the viewmodel.
  const [search, setSearch] = useState(props.searchQuery)
  const [merchant, setMerchant] = useState(props.merchantFilter)
  const debouncedSearch = useDebounce(search, 400)
  const debouncedMerchant = useDebounce(merchant, 400)

  useEffect(() => {
    if (debouncedSearch !== props.searchQuery) props.onSearch(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    if (debouncedMerchant !== props.merchantFilter) props.onMerchant(debouncedMerchant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMerchant])

  const selectClass =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('support.queue.searchPlaceholder')}
            aria-label={t('support.queue.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder={t('support.filters.merchantPlaceholder')}
          aria-label={t('support.filters.merchant')}
          className="w-full sm:w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <select
          value={props.statusFilter}
          onChange={(e) => props.onStatus(e.target.value)}
          className={selectClass}
          aria-label={t('support.filters.status')}
        >
          <option value="">
            {t('support.filters.status')}: {t('support.filters.all')}
          </option>
          {Object.values(TicketStatus).map((s) => (
            <option key={s} value={s}>
              {t(`support.status.${s}`)}
            </option>
          ))}
        </select>

        <select
          value={props.typeFilter}
          onChange={(e) => props.onType(e.target.value)}
          className={selectClass}
          aria-label={t('support.filters.type')}
        >
          <option value="">
            {t('support.filters.type')}: {t('support.filters.all')}
          </option>
          {Object.values(TicketType).map((ty) => (
            <option key={ty} value={ty}>
              {t(`support.type.${ty}`)}
            </option>
          ))}
        </select>

        <select
          value={props.priorityFilter}
          onChange={(e) => props.onPriority(e.target.value)}
          className={selectClass}
          aria-label={t('support.filters.priority')}
        >
          <option value="">
            {t('support.filters.priority')}: {t('support.filters.all')}
          </option>
          {Object.values(TicketPriority).map((p) => (
            <option key={p} value={p}>
              {t(`support.priority.${p}`)}
            </option>
          ))}
        </select>

        {props.showAssigneeControls && (
          <>
            <input
              type="text"
              value={props.assigneeFilter || ''}
              onChange={(e) => props.onAssignee?.(e.target.value)}
              placeholder={t('support.filters.assigneePlaceholder')}
              aria-label={t('support.filters.assignee')}
              disabled={props.unassignedOnly}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-400"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 px-1">
              <input
                type="checkbox"
                checked={props.unassignedOnly || false}
                onChange={(e) => props.onUnassigned?.(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              {t('support.filters.unassignedOnly')}
            </label>
          </>
        )}

        {props.hasActiveFilters && (
          <button
            onClick={props.onClear}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
          >
            {t('support.filters.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
