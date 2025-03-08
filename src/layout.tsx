import './index.css'

import { JSXElement, onMount } from 'solid-js'

import { db } from './db/database'
import { createAppDataDir } from './lib/fs'
import Database from './lib/libsql'
import { createTray } from './lib/tray'

const init = async () => {
  createTray()
  createAppDataDir()

  const libsql = await Database.load('data/local.db')
  console.log('🚀 ~ db:', libsql)

  const result = await libsql.select('SELECT 1')
  console.log('🚀 ~ result:', result)

  const settings = await db.query.settings
    .findMany()
    .execute()
    .then((results) => {
      console.log('🚀 ~ FindMany response from Drizzle:', results)
    })
}

export default function App({ children }: { children?: JSXElement }) {
  onMount(() => {
    init()
  })

  return <main class="flex h-screen w-screen">{children}</main>
}
