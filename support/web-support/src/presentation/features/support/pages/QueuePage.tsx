/**
 * QueuePage — Support Console (/support/queue)
 * The all-merchant support queue: cross-merchant table + full filter set.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardShell } from '../components/DashboardShell'
import { SupportFilters } from '../components/SupportFilters'
import { SupportTicketTable } from '../components/SupportTicketTable'
import { Pagination } from '../../../../shared/components/Pagination'
import { useSupportQueueViewModel } from '../viewmodels/useSupportQueueViewModel'

export function QueuePage() {
  const { t } = useTranslation()
  const vm = useSupportQueueViewModel()

  useEffect(() => {
    vm.loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('support.queue.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {vm.totalItems} {t('support.queue.totalCount')}
          </p>
        </div>

        <SupportFilters
          searchQuery={vm.searchQuery}
          statusFilter={vm.statusFilter}
          typeFilter={vm.typeFilter}
          priorityFilter={vm.priorityFilter}
          merchantFilter={vm.merchantFilter}
          assigneeFilter={vm.assigneeFilter}
          unassignedOnly={vm.unassignedOnly}
          showAssigneeControls
          hasActiveFilters={vm.hasActiveFilters()}
          onSearch={vm.setSearchQuery}
          onStatus={vm.setStatusFilter}
          onType={vm.setTypeFilter}
          onPriority={vm.setPriorityFilter}
          onMerchant={vm.setMerchantFilter}
          onAssignee={vm.setAssigneeFilter}
          onUnassigned={vm.setUnassignedOnly}
          onClear={vm.resetFilters}
        />

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {vm.error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">{vm.error}</p>
            </div>
          )}

          <SupportTicketTable tickets={vm.tickets} loading={vm.loading} showAssignee />

          {!vm.loading && vm.totalItems > 0 && (
            <Pagination
              currentPage={vm.currentPage}
              totalPages={vm.totalPages}
              pageSize={vm.pageSize}
              totalItems={vm.totalItems}
              onPageChange={vm.setCurrentPage}
              onPageSizeChange={vm.setPageSize}
            />
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
