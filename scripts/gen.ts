#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import inquirer from 'inquirer'
import { z } from 'zod'

// CLI flags
program
  .option('--with-presets', 'Include default presets (e.g. isDeleted: false)')
  .option(
    '--docs-format <format>',
    'Output docs as JSON or Markdown',
    /^(json|markdown)$/i,
    'json'
  )
program.parse(process.argv)
const options = program.opts<{ withPresets: boolean; docsFormat: 'json' | 'markdown' }>()

async function main() {
  // 1. Prompt for model name
  const { modelName } = await inquirer.prompt<{ modelName: string }>([
    {
      type: 'input',
      name: 'modelName',
      message: 'Enter the Prisma model name (e.g., Item, WorkspaceMember):',
      validate: (s) => !!s.trim() || 'Model name is required',
    },
  ])

  // 2. Read Prisma model definition
  const modelsDir = path.join(process.cwd(), 'prisma', 'models')
  if (!fs.existsSync(modelsDir)) {
    console.error('❌ prisma/models folder not found')
    process.exit(1)
  }

  const prismaFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.prisma'))
  let modelBlock: string | null = null
  for (const file of prismaFiles) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8')
    const match = content.match(
      new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\}`, 'm')
    )
    if (match) {
      modelBlock = match[1]
      break
    }
  }
  if (!modelBlock) {
    console.error(`❌ Model "${modelName}" not found`)
    process.exit(1)
  }

  // 3. Extract scalar & enum fields
  const PRISMA_SCALARS = new Set([
    'String', 'Int', 'BigInt', 'Float', 'Decimal',
    'Boolean', 'DateTime', 'Json', 'Bytes',
  ])
  const scalarFields: { name: string; type: string }[] = []
  const fieldRe = /^\s*(\w+)\s+([A-Za-z0-9_]+)/gm
  let m
  while ((m = fieldRe.exec(modelBlock))) {
    const [, name, type] = m
    // skip relations and lists
    if (!m[0].includes('@relation') && !type.endsWith('[]')) {
      scalarFields.push({ name, type })
    }
  }

  // detect enum imports
  const enumTypes = Array.from(
    new Set(
      scalarFields
        .map(f => f.type)
        .filter(t => !PRISMA_SCALARS.has(t))
    )
  )
  const enumImports = enumTypes.length
    ? `import { ${enumTypes.join(', ')} } from '@/prisma/enums'\n`
    : ''

  // 4. Operators helpers
  const stringOps = [
    'equals', 'in', 'notIn',
    'contains', 'startsWith', 'endsWith',
  ]
  const defaultOps = [
    'equals', 'in', 'notIn',
    'lt', 'lte', 'gt', 'gte',
  ]
  const operatorsFor = (type: string) =>
    type === 'String' ? stringOps : defaultOps
  const rangeOpsFor = (type: string) =>
    ['gte', 'lte'].filter(op =>
      ['Int','Float','Decimal','DateTime'].includes(type)
    )

  // 5. Preset shape
  const presetShapeLine = options.withPresets
    ? `const presetShape = z.object({ isDeleted: false }).partial()\n\n`
    : ''

  // 6. Build filters template
  const lower = modelName[0].toLowerCase() + modelName.slice(1)

  const filtersTemplate = `import { z } from 'zod'
import { Prisma } from '@/prisma/client'
${enumImports}import { createFilterFactory, buildFiltersFactory } from '@/utils/filters'

${presetShapeLine}export const ${lower}FilterSchema = z
  .object({
${scalarFields
  .map(f => {
    // base zod type
    let base = ''
    switch (f.type) {
      case 'String':   base = 'z.string()'; break
      case 'Int':      base = 'z.number().int()'; break
      case 'BigInt':   base = 'z.coerce.bigint()'; break
      case 'Float':    base = 'z.number()'; break
      case 'Decimal':  base = 'z.number()'; break
      case 'Boolean':  base = 'z.coerce.boolean()'; break
      case 'DateTime': base = 'z.date()'; break
      case 'Json':     base = 'z.any()'; break
      case 'Bytes':    base = 'z.instanceof(Buffer)'; break
      default:         base = `z.nativeEnum(${f.type})`; break
    }
    const ops = operatorsFor(f.type).concat(rangeOpsFor(f.type))
    const shape = `z.object({${ops
      .map(op => `${op}: ${base}.optional()`)
      .join(',')}}).optional()`
    return `    ${f.name}: ${shape},`
  })
  .join('\n')}
  })
  .partial()
}

const create${modelName}Filter = createFilterFactory<
  Prisma.${modelName}WhereInput,
  z.infer<typeof ${lower}FilterSchema>
>()

export const ${lower}Filters = {
${scalarFields
  .map(f => {
    const ops = operatorsFor(f.type).concat(rangeOpsFor(f.type))
    const shape = `z.object({${ops
      .map(op =>
        op === 'contains'
          ? `contains: z.string().optional()`
          : `${op}: z.any().optional()`
      )
      .join(',')}}).optional()`
    return `  ${f.name}: create${modelName}Filter(${shape}, (${f.name}) => ({ ${f.name} })),`
  })
  .join('\n')}
}

export const build${modelName}Filters = buildFiltersFactory({
  filters: ${lower}Filters,
  schema: ${lower}FilterSchema,
})

${options.docsFormat === 'json'
    ? `export const ${lower}FilterDocs = ${JSON.stringify(
        Object.fromEntries(
          scalarFields.map(f => [
            f.name,
            {
              type: f.type,
              operators: operatorsFor(f.type)
                .concat(rangeOpsFor(f.type)),
            },
          ])
        ),
        null, 2
      )}`
    : (() => {
        // markdown table
        const rows = scalarFields.map(f => {
          const ops = operatorsFor(f.type).concat(rangeOpsFor(f.type))
          return `| ${f.name} | ${f.type} | ${ops.join(', ')} |`
        })
        return `// Filter docs (Markdown)\n/*\n| Field | Type | Operators |\n|-------|------|-----------|\n${rows.join('\n')}\n*/`
      })()
}

`

  // write filters file
  const outDir = path.join(process.cwd(), 'app', '.server', 'repositories')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${lower}Filters.ts`), filtersTemplate)

  // 7. Repo template (unchanged from earlier full script)
  const relationFields: string[] = [] // detect as before if you need includes
  const defaultIncludeObj = '{}'        // fill in dynamically if desired
  const repoTemplate = `import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'  
import { build${modelName}Filters, ${lower}FilterSchema } from './${lower}Filters'
import { searchFactory } from '@/utils/search'
import type { IRepository } from '@/services/IRepository'
import { z } from 'zod'

const defaultInclude = ${defaultIncludeObj}

type ${modelName}WithRelations = Prisma.${modelName}GetPayload<typeof defaultInclude extends Prisma.${modelName}IncludeArgs ? { include: typeof defaultInclude } : object> & {
  // Add relations here if not using defaultInclude
}>

const defaultOrderBy = (
  params: z.infer<typeof ${lower}FilterSchema>
): Prisma.${modelName}OrderByWithRelationInput => ({
  // updatedAt: 'desc',
})

export class ${modelName}Repository
  implements IRepository<${modelName}WithRelations, '${modelName}'> {
  private db: typeof prisma
  private search${modelName}s

  constructor(dbClient: typeof prisma) {
    this.db = dbClient
    this.search${modelName}s = searchFactory(
      this.db.${lower},
      build${modelName}Filters,
      defaultInclude,
      defaultOrderBy
    )
  }

  async findById(id: number | string): Promise<${modelName}WithRelations | null> {
    return this.db.${lower}.findUnique({
      where: { id: Number(id) },
      include: defaultInclude,
    })
  }
  
  async delete(id: number | string): Promise<${modelName}WithRelations> {
    return this.db.${lower}.delete({
      where: { id: Number(id) },
      include: defaultInclude,
    })
  } 

  async findMany(params: z.infer<typeof ${lower}FilterSchema>) {
    return this.db.${lower}.findMany({
      where: build${modelName}Filters(params),
      include: defaultInclude,
    })
  }

  async findFirst(params: z.infer<typeof ${lower}FilterSchema>): Promise<${modelName}WithRelations | null> {
    return this.db.${lower}.findFirst({ where: build${modelName}Filters(params), include: defaultInclude })
  }

  async search(params: z.infer<typeof ${lower}FilterSchema>) {
    return this.search${modelName}s(params)
  }

  async create(data: Prisma.${modelName}CreateInput): Promise<${modelName}WithRelations> {
    return this.db.${lower}.create({ data, include: defaultInclude })
  }

  async update(
    id: number | string,
    data: Prisma.${modelName}UpdateInput
  ): Promise<${modelName}WithRelations> {
    return this.db.${lower}.update({ where: { id: Number(id) }, data, include: defaultInclude })
  }
}
`
  fs.writeFileSync(path.join(outDir, `${lower}Repository.ts`), repoTemplate)

  console.log('✅ Filters and repository generated successfully.')
}

main()
