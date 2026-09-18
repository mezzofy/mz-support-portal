/**
 * MyAssignedPage — Support Console (/support/my)
 * Tickets assigned to the signed-in agent ("my" scoped server-side).
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardShell } from '../components/DashboardShell'
import { SupportFilters } from '../components/SupportFilters'
import { SupportTicketTable } from '../components/SupportTicketTable'
import { Pagination } from '../../../../shared/components/Pagination'
import { useMyAssignedViewModel } from '../viewmodels/useMyAssignedViewModel'

export function MyAssignedPage() {
  const { t } = useTranslation()
  const vm = useMyAssignedViewModel()

  useEffect(() => {
    vm.loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('support.myAssigned.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {vm.totalItems} {t('support.myAssigned.totalCount')}
          </p>
        </div>

        <SupportFilters
          searchQuery={vm.searchQuery}
          statusFilter={vm.statusFilter}
          typeFilter={vm.typeFilter}
          priorityFilter={vm.priorityFilter}
          merchantFilter={vm.merchantFilter}
          showAssigneeControls={false}
          hasActiveFilters={vm.hasActiveFilters()}
          onSearch={vm.setSearchQuery}
          onStatus={vm.setStatusFilter}
          onType={vm.setTypeFilter}
          onPriority={vm.setPriorityFilter}
          onMerchant={vm.setMerchantFilter}
          onClear={vm.resetFilters}
        />

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {vm.error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">{vm.error}</p>
            </div>
          )}

          <SupportTicketTable tickets={vm.tickets} loading={vm.loading} showAssignee={false} />

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
