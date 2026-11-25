import { LanguageProvider } from '@/i18n/context'
import { ServerProvider } from '@/context/ServerContext'
import { GuestUserProvider } from '@/features/guest-user/GuestUserContext'
import { HomeStatusProvider } from '@/context/HomeStatusContext'
import { PolicyBookProvider } from '@/context/PolicyBookContext'
import { HomeButtonProvider } from '@/context/HomeButtonContext'

/**
 * Providers — the global context providers, composed once around the app.
 * Order matters: ServerProvider (server selection) wraps everything so the
 * guest session can read it; LanguageProvider sits in between.
 */
export default function Providers({ children }) {
  return (
    <ServerProvider>
      <LanguageProvider>
        <GuestUserProvider>
          <HomeStatusProvider>
            <PolicyBookProvider>
              <HomeButtonProvider>
                {children}
              </HomeButtonProvider>
            </PolicyBookProvider>
          </HomeStatusProvider>
        </GuestUserProvider>
      </LanguageProvider>
    </ServerProvider>
  )
}
