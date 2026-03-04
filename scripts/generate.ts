#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import inquirer from 'inquirer'
import { z } from 'zod'

// --- CLI Configuration ---

program
  .option('-m', '--model <name>', 'The name of the model to generate files for')
  .option('--format [format]', 'Output docs as JSON or Markdown', 'markdown')
  .description('Generate filter and repository files for a Prisma model')
  .helpOption('-h, --help', 'Display help for command')
  .parse(process.argv)

const options = program.opts<{
  format: 'json' | 'markdown'
  model: string
}>()

// --- Utility Functions ---

/**
 * Extracts a model definition block from Prisma schema files.
 * @param modelName The name of the model to find.
 * @param modelsDir The directory containing Prisma model files.
 * @returns The string content of the model block, or null if not found.
 */
function findModelBlock(modelName: string, modelsDir: string): string | null {
  const prismaFiles = fs
    .readdirSync(modelsDir)
    .filter((f) => f.endsWith('.prisma'))

  for (const file of prismaFiles) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8')
    const modelRegex = new RegExp(
      `model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\}`,
      'm'
    )
    const match = content.match(modelRegex)
    if (match) {
      return match[1]
    }
  }
  return null
}

type ParsedFields = {
  scalarFields: { name: string; type: string }[]
  relationFields: string[]
  enumTypes: string[]
}

/**
 * Parses a model block to categorize fields.
 * @param modelBlock The string content of a Prisma model block.
 * @returns An object containing scalar fields, relation fields, and enum types.
 */
function parseModelFields(modelBlock: string): ParsedFields {
  const PRISMA_SCALARS = new Set([
    'String',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'Boolean',
    'DateTime',
    'Json',
    'Bytes',
  ])

  const scalarFields: { name: string; type: string }[] = []
  const relationFields: string[] = []
  const fieldRegex = /^\s*(\w+)\s+([A-Za-z0-9_]+(?:\[\])?)/gm
  let match

  while ((match = fieldRegex.exec(modelBlock)) !== null) {
    const [, name, type] = match
    const isList = type.endsWith('[]')
    const isRelation =
      /@relation/.test(match[0]) || !PRISMA_SCALARS.has(type.replace('[]', ''))

    if (!isList && !isRelation) {
      scalarFields.push({ name, type })
    } else if (isRelation) {
      relationFields.push(name)
    }
  }

  const enumTypes = [
    ...new Set(
      scalarFields.map((f) => f.type).filter((t) => !PRISMA_SCALARS.has(t))
    ),
  ]

  return { scalarFields, relationFields, enumTypes }
}

// --- Template Generation ---

const ZOD_TYPE_MAP: Record<string, string> = {
  String: 'z.string()',
  Int: 'z.number().int()',
  BigInt: 'z.coerce.bigint()',
  Float: 'z.number()',
  Decimal: 'z.number()',
  Boolean: 'z.coerce.boolean()',
  DateTime: 'z.date()',
  Json: 'z.any()',
  Bytes: 'z.instanceof(Buffer)',
}

/**
 * Generates the content for the filter configuration file.
 */
function createFiltersTemplate(
  modelName: string,
  { scalarFields, enumTypes }: ParsedFields
) {
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  const enumImports = enumTypes.length
    ? `import { ${enumTypes.join(', ')} } from '@/prisma/client';\n`
    : ''

  const schemaFields = scalarFields
    .map((field) => {
      const zodType = ZOD_TYPE_MAP[field.type] || `z.enum(${field.type})`
      return `		${field.name}: ${zodType},`
    })
    .join('\n')

  const filterObjects = scalarFields
    .map((field) => {
      const zodType = ZOD_TYPE_MAP[field.type] || `z.enum(${field.type})`
      return `	${field.name}: create${modelName}Filter(${zodType}, (value) => ({ ${field.name}: value })),`
    })
    .join('\n')

  return `import { z } from 'zod';
import { Prisma } from '@/prisma/client';
${enumImports}import { createFilter, buildFiltersFactory } from '@/utils/filters';

export const ${lower}FilterSchema = z
	.object({
${schemaFields}
	})
	.partial();

/**
 * Factory for creating ${lower}-specific filters.
 */
const create${modelName}Filter = createFilter<
	Prisma.${modelName}WhereInput,
	z.infer<typeof ${lower}FilterSchema>
>();

/**
 * All available ${lower} filters.
 */
export const ${lower}Filters = {
${filterObjects}
};

/**
 * Build ${lower} filters from provided params.
 */
export const build${modelName}Filters = buildFiltersFactory({
	filters: ${lower}Filters,
	schema: ${lower}FilterSchema,
});
`
}

const getDefaultOrderBy = (modelName: string) => {
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  return `const defaultOrderBy = (
	params: z.infer<typeof ${lower}FilterSchema>
): Prisma.${modelName}OrderByWithRelationInput => ({
	// TODO: Define a default order-by for the model
	createdAt: 'desc',
})`
}

/**
 * Generates the content for the repository file.
 */
function createRepoTemplate(
  modelName: string,
  { relationFields }: ParsedFields
) {
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)

  const defaultOrderBy = getDefaultOrderBy(modelName)

  return `import { prisma } from '@/services/db'
import type { Prisma, ${modelName} } from '@/prisma/client'
import {
	build${modelName}Filters,
	${lower}FilterSchema,
} from '@/services/filters/${lower}.filters'
import { z } from 'zod'
import { searchFactory } from '@/utils/search'

/**
 * A Prisma transaction client, compatible with the full client.
 */
type PrismaTx = Omit<
	typeof prisma,
	'$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

${defaultOrderBy}

/** Repository for the \`${modelName}\` model.
 * Provides CRUD operations plus a handful of convenience helpers.
 */
export const ${lower}Repository = {
	search: searchFactory({
		dbDelegate: prisma.${lower},
		buildFilters: build${modelName}Filters,
		defaultOrderBy,
	}),

	// ====================================================== //
	// =================== CRUD Operations ================== //
	// ====================================================== //

	findById(id: string, tx?: PrismaTx): Promise<${modelName} | null> {
		const db = tx || prisma
		return db.${lower}.findUnique({ where: { id } })
	},

	findAll(args: Prisma.${modelName}FindManyArgs, tx?: PrismaTx): Promise<${modelName}[]> {
		const db = tx || prisma
		return db.${lower}.findMany(args)
	},

	create(
		data: Prisma.${modelName}CreateInput,
		tx?: PrismaTx
	): Promise<${modelName}> {
		const db = tx || prisma
		return db.${lower}.create({ data })
	},

	update(
		args: Prisma.${modelName}UpdateArgs,
		tx?: PrismaTx
	): Promise<${modelName}> {
		const db = tx || prisma
		return db.${lower}.update(args)
	},

	delete(
		id: string,
		tx?: PrismaTx
	): Promise<${modelName}> {
		const db = tx || prisma
		return db.${lower}.delete({ where: { id } })
	},

	// =========================================================
	//  CUSTOM METHODS
	// =========================================================

}
`
}

// --- Main Execution ---

async function main() {
  let modelName = options.model
  if (!modelName) {
    const answer = await inquirer.prompt<{ modelName: string }>([
      {
        type: 'input',
        name: 'modelName',
        message: 'Enter the Prisma model name (e.g., User, Item):',
        validate: (s) => !!s.trim() || 'Model name is required',
      },
    ])
    modelName = answer.modelName
  }

  // 2. Find and parse model
  const modelsDir = path.join(process.cwd(), 'prisma', 'models')
  if (!fs.existsSync(modelsDir)) {
    console.error('❌ Could not find prisma/models folder')
    process.exit(1)
  }

  const modelBlock = findModelBlock(modelName, modelsDir)
  if (!modelBlock) {
    console.error(`❌ Model '${modelName}' not found in prisma/models`)
    process.exit(1)
  }

  const parsedFields = parseModelFields(modelBlock)
  const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)

  // 3. Define paths
  const filtersDir = path.join('app', '.server', 'filters')
  const reposDir = path.join('app', '.server', 'repositories')
  const filterFile = `${lower}.filters.ts`
  const repoFile = `${lower}.repository.ts` // Corrected file name
  const filterPath = path.join(filtersDir, filterFile)
  const repoPath = path.join(reposDir, repoFile)

  // 4. Ensure directories exist
  fs.mkdirSync(filtersDir, { recursive: true })
  fs.mkdirSync(reposDir, { recursive: true })

  // 5. Generate and write files
  const filtersTemplate = createFiltersTemplate(modelName, parsedFields)
  const repoTemplate = createRepoTemplate(modelName, parsedFields)

  fs.writeFileSync(filterPath, filtersTemplate)
  console.log(`✅ Generated filter: ${filterPath}`)

  fs.writeFileSync(repoPath, repoTemplate)
  console.log(`✅ Generated repository: ${repoPath}`)

  console.log('\n✨ Generation complete!')
  console.log(
    `ℹ️  Relations found: ${parsedFields.relationFields.join(', ') || '(none)'}`
  )
}

main().catch((error) => {
  console.error('An error occurred:', error)
  process.exit(1)
})
