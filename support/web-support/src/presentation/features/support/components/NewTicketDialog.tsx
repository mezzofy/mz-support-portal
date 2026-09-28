/**
 * NewTicketDialog — Support Console
 *
 * Staff logs a ticket on behalf of a merchant (Option C intake) via
 * createSupportTicket. merchantId is free-text (no directory yet); an optional
 * merchantName registers the merchant so the queue shows a name.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, TicketPlus } from 'lucide-react'
import { TicketType, TicketPriority } from '../../../../domain/entities/support-ticket.entity'
import type { CreateSupportTicketInput } from '../../../../domain/repositories/support-ticket.repository.interface'

interface Props {
  open: boolean
  pending?: boolean
  error?: string | null
  onClose: () => void
  onCreate: (input: CreateSupportTicketInput) => void
}

const SUBJECT_MIN = 3
const SUBJECT_MAX = 200
const DESC_MIN = 10
const DESC_MAX = 5000

export function NewTicketDialog({ open, pending, error, onClose, onCreate }: Props) {
  const { t } = useTranslation()
  const [merchantId, setMerchantId] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [type, setType] = useState<string>(TicketType.GENERAL)
  const [priority, setPriority] = useState<string>(TicketPriority.MEDIUM)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')

  if (!open) return null

  const valid =
    merchantId.trim().length > 0 &&
    subject.trim().length >= SUBJECT_MIN &&
    subject.trim().length <= SUBJECT_MAX &&
    description.trim().length >= DESC_MIN &&
    description.trim().length <= DESC_MAX

  const submit = () => {
    if (!valid) return
    onCreate({
      merchantId: merchantId.trim(),
      merchantName: merchantName.trim() || undefined,
      type,
      priority,
      subject: subject.trim(),
      description: description.trim(),
    })
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('support.createTicket.title')}
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100"
          aria-label={t('support.header.close')}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
            <TicketPlus className="w-5 h-5 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t('support.createTicket.title')}</h2>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nt-merchant-id" className={labelClass}>
                {t('support.createTicket.merchantId')} *
              </label>
              <input
                id="nt-merchant-id"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                className={inputClass}
                placeholder="merc_..."
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="nt-merchant-name" className={labelClass}>
                {t('support.createTicket.merchantName')}
              </label>
              <input
                id="nt-merchant-name"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nt-type" className={labelClass}>
                {t('support.createTicket.type')}
              </label>
              <select
                id="nt-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                {Object.values(TicketType).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nt-priority" className={labelClass}>
                {t('support.createTicket.priority')}
              </label>
              <select
                id="nt-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                {Object.values(TicketPriority).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="nt-subject" className={labelClass}>
              {t('support.createTicket.subject')} *
            </label>
            <input
              id="nt-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
              maxLength={SUBJECT_MAX}
              placeholder={t('support.createTicket.subjectPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="nt-description" className={labelClass}>
              {t('support.createTicket.description')} *
            </label>
            <textarea
              id="nt-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={DESC_MAX}
              className={inputClass}
              placeholder={t('support.createTicket.descriptionPlaceholder')}
            />
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t('support.common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={pending || !valid}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? t('support.common.saving') : t('support.createTicket.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
