import { inspect } from 'node:util'
import {
  buildItemFilters,
  itemFilterSchema,
} from '../app/utils/filters/item.filters'
import { parseSearchParams } from '../app/utils/parsers'
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { addQueryParamValue } from '../app/utils/query-params'
import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../app/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const options: ParseArgsConfig = {
  options: {
    filter: { type: 'string' },
    value: { type: 'string' },
    name: { type: 'string' },
  },
  allowPositionals: true,
  tokens: true,
} as const

async function main() {
  const {
    values: { filter, value },
    positionals,
    tokens,
  } = parseArgs(options)
  const mockUrl = new URL('https://stashly.dev')
  let searchParams = mockUrl.searchParams
  switch (filter) {
    case 'tags': {
      searchParams = addQueryParamValue(searchParams, 'tags', 'tag1,tag3')
      break
    }
    case 'category': {
      searchParams = addQueryParamValue(
        searchParams,
        'category',
        'video, image, code'
      )
      break
    }
    case 'favorited': {
      searchParams = addQueryParamValue(searchParams, 'favorited', `${value}`)
      break
    }
    case 'locked': {
      searchParams = addQueryParamValue(searchParams, 'locked', `${value}`)
      break
    }
    case 'query': {
      searchParams = addQueryParamValue(searchParams, 'query', `${value}`)
      break
    }
    case 'date': {
      searchParams = addQueryParamValue(searchParams, 'date[after]', `${value}`)
      searchParams = addQueryParamValue(
        searchParams,
        'date[before]',
        `${value}`
      )
      break
    }
    case 'type': {
      searchParams = addQueryParamValue(searchParams, 'type', `${value}`)
      break
    }
    case 'collection': {
      searchParams = addQueryParamValue(searchParams, 'collection', `${value}`)
      break
    }
    case 'parent': {
      searchParams = addQueryParamValue(searchParams, 'parent', `${value}`)
      break
    }
    case 'trashed': {
      searchParams = addQueryParamValue(searchParams, 'trashed', `${value}`)
      break
    }
    case 'workspace': {
      searchParams = addQueryParamValue(searchParams, 'workspace', `${value}`)
      break
    }
    case 'all': {
      break
    }
    default: {
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
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
