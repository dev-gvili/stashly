import { inspect } from 'node:util'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from './parsers'
import { prisma } from '../.server/db'
import { config } from '@dotenvx/dotenvx'
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { addQueryParamValue } from './query-params'

const options: ParseArgsConfig = {
  options: {
    filter: { type: 'string' },
    value: { type: 'string' },
    name: { type: 'string' },
  },
  allowPositionals: true,
  tokens: true,
} as const

config()

async function main() {
  const {
    values: { filter, value },
    positionals,
    tokens,
  } = parseArgs(options)

  console.log('filter:', filter)
  console.log('positionals:', positionals)
  console.log('tokens:', tokens)

  const mockUrl = new URL('https://stashly.dev')
  let searchParams = mockUrl.searchParams

  console.log('Original URL:', mockUrl.href)

  switch (filter) {
    case 'tags': {
      console.log('tags filter')
      searchParams = addQueryParamValue(searchParams, 'tags', 'tag1,tag3')
      break
    }
    case 'category': {
      console.log('category filter')
      searchParams = addQueryParamValue(
        searchParams,
        'category',
        'video, image, code'
      )
      break
    }
    case 'favorited': {
      console.log('favorited filter')
      searchParams = addQueryParamValue(searchParams, 'favorited', `${value}`)
      break
    }
    case 'locked': {
      console.log('locked filter')
      searchParams = addQueryParamValue(searchParams, 'locked', `${value}`)
      break
    }
    case 'query': {
      console.log('query filter')
      searchParams = addQueryParamValue(searchParams, 'query', `${value}`)
      break
    }
    case 'date': {
      console.log('date filter')
      searchParams = addQueryParamValue(searchParams, 'date[after]', `${value}`)
      searchParams = addQueryParamValue(
        searchParams,
        'date[before]',
        `${value}`
      )
      break
    }
    case 'type': {
      console.log('type filter')
      searchParams = addQueryParamValue(searchParams, 'type', `${value}`)
      break
    }
    case 'collection': {
      console.log('collection filter')
      searchParams = addQueryParamValue(searchParams, 'collection', `${value}`)
      break
    }
    case 'parent': {
      console.log('parent filter')
      searchParams = addQueryParamValue(searchParams, 'parent', `${value}`)
      break
    }
    case 'trashed': {
      console.log('trashed filter')
      searchParams = addQueryParamValue(searchParams, 'trashed', `${value}`)
      break
    }
    case 'workspace': {
      console.log('workspace filter')
      searchParams = addQueryParamValue(searchParams, 'workspace', `${value}`)
      break
    }
    case 'all': {
      console.log('all filter')
      break
    }
    default: {
      console.log('default filter')
      break
    }
  }
  let params = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(params)

  const items = await prisma.item.findMany({
    where: filters,
    include: {
      favorites: true,
      locked: true,
      parent: true,
      children: true,
      thumbnails: true,
      folder: true,
      file: true,
      drive: true,
      owner: true,
      permissions: true,
      search: true,
      trash: true,
      _count: true,
    },
  })
  console.log(inspect(items, { colors: true, depth: null }))
  console.log(inspect(`Filtered items: ${items.length}`, { colors: true }))
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
