import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import ChatDetailPage from '@/chats/detail'
import ChatLayout from '@/chats/layout2'
import { SidebarProvider } from '@/components/ui/sidebar'
import AccountsSettingsPage from '@/settings/accounts'
import Settings from '@/settings/index'
import ModelDetailPage from '@/settings/models/detail'
import ModelsLayout from '@/settings/models/layout'
import NewModelPage from '@/settings/models/new'
import { useEffect, useState } from 'react'
import { getSettings, seedModels } from './dal'
import { initializeDrizzleDatabase } from './db/database'
import { migrate } from './db/migrate'
import { DrizzleProvider } from './db/provider'
import DevToolsPage from './devtools'
import ImapClient from './imap/imap'
import { ImapProvider } from './imap/provider'
import Layout from './layout'
import { createAppDataDir } from './lib/fs'
import { TrayManager, TrayProvider } from './lib/tray'
import Loading from './loading'
import SettingsLayout from './settings/layout'
import { SettingsProvider } from './settings/provider'
import { SideviewProvider } from './sideview/provider'
import { ImapSyncClient, ImapSyncProvider } from './sync'
import { InitData, Settings as SettingsType, SideviewType } from './types'
import UiKitPage from './ui-kit'
import WelcomePage from './welcome'

const queryClient = new QueryClient()

const init = async (): Promise<InitData> => {
  const appDataDirPath = await createAppDataDir()

  const { db, sqlite } = await initializeDrizzleDatabase(`${appDataDirPath}/local.db`)

  await migrate({ sqlite })

  const settings = (await getSettings<SettingsType>(db, 'main')) || {}

  await seedModels(db)

  const imap = new ImapClient()
  const imapSync = new ImapSyncClient()

  if (settings.account) {
    await imap.initialize({
      hostname: settings.account.hostname,
      port: settings.account.port,
      username: settings.account.username,
      password: settings.account.password,
    })

    // Initialize the IMAP sync client after the IMAP client
    await imapSync.initialize()
  } else {
    console.warn('No IMAP account settings found')
  }

  const tray = await TrayManager.init()

  const url = new URL(window.location.href)
  const sideviewParam = url.searchParams.get('sideview')

  let sideviewType: SideviewType | null = null
  let sideviewId: string | null = null

  if (sideviewParam) {
    const [type, id] = sideviewParam.split(':')
    if (type && id) {
      sideviewType = type as SideviewType
      sideviewId = decodeURIComponent(id)
    }
  }

  return {
    db,
    sqlite,
    settings,
    imap,
    imapSync,
    sideviewType,
    sideviewId,
    ...tray,
  }
}

export const App = () => {
  const [initData, setInitData] = useState<InitData>()

  useEffect(() => {
    init().then(setInitData)
  }, [])

  if (!initData) {
    return <Loading />
  }

  return (
    <TrayProvider tray={initData.tray} window={initData.window}>
      <QueryClientProvider client={queryClient}>
        <DrizzleProvider context={{ db: initData.db, sqlite: initData.sqlite }}>
          <ImapProvider client={initData.imap}>
            <ImapSyncProvider client={initData.imapSync}>
              <SettingsProvider initialSettings={initData.settings} section="main">
                <SidebarProvider>
                  <SideviewProvider sideviewType={initData.sideviewType} sideviewId={initData.sideviewId}>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/" element={<Layout />}>
                          {/* Home routes with HomeLayout */}
                          <Route element={<ChatLayout />}>
                            {/* <Route index element={<ChatNewPage />} /> */}
                            <Route index element={<WelcomePage />} />
                            <Route path="chats/:chatThreadId" element={<ChatDetailPage />} />
                          </Route>

                          {/* Settings routes with SettingsLayout */}
                          <Route path="settings" element={<SettingsLayout />}>
                            <Route index element={<Settings />} />
                            <Route path="accounts" element={<AccountsSettingsPage />} />
                            <Route path="models" element={<ModelsLayout />}>
                              <Route index element={<Navigate to="/settings/models/new" replace />} />
                              <Route path="new" element={<NewModelPage />} />
                              <Route path=":modelId" element={<ModelDetailPage />} />
                            </Route>
                          </Route>

                          <Route path="ui-kit" element={<UiKitPage />} />
                          <Route path="devtools" element={<DevToolsPage />} />
                        </Route>
                      </Routes>
                    </BrowserRouter>
                  </SideviewProvider>
                </SidebarProvider>
              </SettingsProvider>
            </ImapSyncProvider>
          </ImapProvider>
        </DrizzleProvider>
      </QueryClientProvider>
    </TrayProvider>
  )
}
