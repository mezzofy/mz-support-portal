/**
 * LoginPage — Support Console
 *
 * Option B (auth reuse): two-step staff login against the mz-ai-assistant auth
 * API — email+password -> emailed OTP code -> JWT. On success the JWT is stored
 * (saveSession) and the agent lands on the queue. Staff = mz-ai users with a
 * support-console role (support_agent / support_manager); svc-support enforces
 * the role on every GraphQL request.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { authApi, AuthApiError } from '../../../../data/datasources/auth-api.datasource'
import { saveSession, isDevBypass, getAuthToken } from '../hooks/useAuth'

type Step = 'credentials' | 'otp'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Already authenticated (or dev bypass) → skip the form.
  if (isDevBypass() || getAuthToken()) {
    navigate('/queue', { replace: true })
  }

  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function messageFor(e: unknown): string {
    if (e instanceof AuthApiError) {
      return e.code === 'NETWORK' ? t('support.auth.login.errors.network') : e.message
    }
    return t('support.auth.login.errors.generic')
  }

  async function handleCredentials(ev: FormEvent) {
    ev.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const res = await authApi.login(email.trim(), password)
      setOtpToken(res.otp_token)
      setStep('otp')
      setNotice(t('support.auth.login.otpSubtitle', { email: email.trim() }))
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(ev: FormEvent) {
    ev.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = await authApi.verifyOtp(otpToken, code.trim())
      saveSession(session)
      navigate('/queue', { replace: true })
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await authApi.resendOtp(otpToken)
      setNotice(t('support.auth.login.resendSent'))
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setBusy(false)
    }
  }

  function backToCredentials() {
    setStep('credentials')
    setCode('')
    setError('')
    setNotice('')
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black ' +
    'focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-60'
  const primaryBtn =
    'w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white ' +
    'hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ' +
    'disabled:cursor-not-allowed disabled:opacity-60'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-black">
            <span className="text-lg font-bold text-orange-500">M</span>
          </div>
          <h1 className="text-lg font-semibold text-black">{t('support.auth.login.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('support.auth.login.subtitle')}</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && !error && (
          <p role="status" className="mb-4 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">
            {notice}
          </p>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                {t('support.auth.login.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                {t('support.auth.login.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={busy || !email || !password} className={primaryBtn}>
              {busy ? t('support.auth.login.sending') : t('support.auth.login.sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
                {t('support.auth.login.code')}
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
                className={`${inputClass} text-center tracking-[0.4em]`}
              />
            </div>
            <button type="submit" disabled={busy || !code} className={primaryBtn}>
              {busy ? t('support.auth.login.verifying') : t('support.auth.login.verify')}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={backToCredentials}
                disabled={busy}
                className="text-gray-500 hover:text-black disabled:opacity-60"
              >
                {t('support.auth.login.back')}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="font-medium text-orange-600 hover:text-orange-700 disabled:opacity-60"
              >
                {t('support.auth.login.resend')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
