/**
 * Vitest global setup — Support Console tests.
 * - reflect-metadata: required by InversifyJS @injectable decorators.
 * - jest-dom: DOM assertion matchers.
 * - i18n init: so useTranslation() resolves real keys in component tests.
 * - scrollTo stub: jsdom does not implement Element.prototype.scrollTo
 *   (SupportChatPanel auto-scrolls on new messages).
 */
import 'reflect-metadata'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '../src/i18n/config'

// jsdom lacks Element.scrollTo — provide a no-op so the chat panel can mount.
if (!('scrollTo' in Element.prototype)) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollTo = () => {}
}

afterEach(() => {
  cleanup()
})
