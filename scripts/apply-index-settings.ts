// scripts/apply-index-settings.js
import { config } from '@dotenvx/dotenvx'
import { algoliasearch } from 'algoliasearch'
import settings from './algolia-settings.json'

config() // Load .env file

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_ADMIN_KEY!
)
// const index = client.setSettings(process.env.ALGOLIA_INDEX || 'items_index')

client
  .setSettings({
    indexName: process.env.ALGOLIA_INDEX || 'items_index',
    indexSettings: settings,
  })
  .then(() => {
    console.log('Algolia settings applied')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Failed to apply settings:', err)
    process.exit(1)
  })
