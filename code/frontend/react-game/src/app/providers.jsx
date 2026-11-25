import { LanguageProvider } from '@/i18n/context'
import { ServerProvider } from '@/context/ServerContext'
import { GuestUserProvider } from '@/features/guest-user/GuestUserContext'
import { HomeStatusProvider } from '@/context/HomeStatusContext'
import { PolicyBookProvider } from '@/context/PolicyBookContext'
import { HomeButtonProvider } from '@/context/HomeButtonContext'
import { PreferencesProvider } from '@/preferences/PreferencesContext'

/**
 * Providers — the global context providers, composed once around the app.
 * Order matters: ServerProvider (server selection) wraps everything so the
 * guest session can read it; LanguageProvider sits in between.
 * Step 16 — PreferencesProvider holds the device's display choices and the AnimationProvider of step 14.
 */
export default function Providers({ children }) {
  return (
    <ServerProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <GuestUserProvider>
            <HomeStatusProvider>
              <PolicyBookProvider>
                <HomeButtonProvider>
                  {children}
                </HomeButtonProvider>
              </PolicyBookProvider>
            </HomeStatusProvider>
          </GuestUserProvider>
        </PreferencesProvider>
      </LanguageProvider>
    </ServerProvider>
  )
}
