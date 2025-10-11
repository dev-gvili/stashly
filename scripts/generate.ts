#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import inquirer from 'inquirer'
import { z } from 'zod'

// --- CLI Configuration ---

program
	.option(
		'-m',
		'--model <name>',
		'The name of the model to generate files for'
	)
	.option(
		'--format [format]',
		'Output docs as JSON or Markdown',
        'markdown',
	)
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
			/@relation/.test(match[0]) ||
			!PRISMA_SCALARS.has(type.replace('[]', ''))

		if (!isList && !isRelation) {
			scalarFields.push({ name, type })
		} else if (isRelation) {
			relationFields.push(name)
		}
	}

	const enumTypes = [
		...new Set(
			scalarFields
				.map((f) => f.type)
				.filter((t) => !PRISMA_SCALARS.has(t))
		),
	]

	return { scalarFields, relationFields, enumTypes }
}

// --- Template Generation ---

const OPERATORS = {
	string: ['equals'],
	array: ['in', 'notIn'],
	default: ['equals'],
	range: ['gte', 'lte'],
}

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

function getOperatorsForType(type: string): string[] {
	return type === 'String'
		? OPERATORS.string
		: OPERATORS.default.concat(OPERATORS.array)
}

function getRangeOperatorsForType(type: string): string[] {
	return ['Int', 'Float', 'Decimal', 'DateTime'].includes(type)
		? OPERATORS.range
		: []
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
		? `import { ${enumTypes.join(', ')} } from '@/prisma/enums';\n`
		: ''

	const schemaFields = scalarFields
		.map((field) => {
			const baseType =
				ZOD_TYPE_MAP[field.type] || `z.nativeEnum(${field.type})`
			const operators = getOperatorsForType(field.type).concat(
				getRangeOperatorsForType(field.type)
			)
			const shape = `z.object({ ${operators
				.map((op) => `${op}: ${baseType}.optional()`)
				.join(', ')} }).optional()`
			return `    ${field.name}: ${shape},`
		})
		.join('\n')

	const filterObjects = scalarFields
		.map((field) => {
			const operators = getOperatorsForType(field.type).concat(
				getRangeOperatorsForType(field.type)
			)
			const shape = `z.object({ ${operators
				.map(
					(op) =>
						`${op}: z.${
							op === 'contains' ? 'string' : 'any'
						}().optional()`
				)
				.join(', ')} }).optional()`
			return `  ${field.name}: create${modelName}Filter(${shape}, (${field.name}) => ({ ${field.name} })),`
		})
		.join('\n')

	const docs =
		options.format === 'json'
			? createJsonDocs(lower, scalarFields)
			: createMarkdownDocs(scalarFields)

	return `import { z } from 'zod';
import { Prisma } from '@/prisma/client';
${enumImports}import { createFilterFactory, buildFiltersFactory } from '@/utils/filters';

export const ${lower}FilterSchema = z
  .object({
${schemaFields}
  })
  .partial();

const create${modelName}Filter = createFilterFactory<
  Prisma.${modelName}WhereInput,
  z.infer<typeof ${lower}FilterSchema>
>();

export const ${lower}Filters = {
${filterObjects}
};

export const build${modelName}Filters = buildFiltersFactory({
  filters: ${lower}Filters,
  schema: ${lower}FilterSchema,
});

export type ${modelName}FilterParams = z.infer<typeof ${lower}FilterSchema>;

${docs}
`
}

function createJsonDocs(
	lower: string,
	scalarFields: { name: string; type: string }[]
) {
	const docObject = Object.fromEntries(
		scalarFields.map((field) => [
			field.name,
			{
				type: field.type,
				operators: getOperatorsForType(field.type).concat(
					getRangeOperatorsForType(field.type)
				),
			},
		])
	)
	return `export const ${lower}FilterDocs = ${JSON.stringify(
		docObject,
		null,
		2
	)};`
}

function createMarkdownDocs(scalarFields: { name: string; type: string }[]) {
	const rows = scalarFields.map((field) => {
		const operators = getOperatorsForType(field.type).concat(
			getRangeOperatorsForType(field.type)
		)
		return `| ${field.name} | ${field.type} | ${operators.join(', ')} |`
	})
	return `/**
 * Filter Documentation (Markdown)
 *
 * | Field       | Type     | Operators                               |
 * |-------------|----------|-----------------------------------------|
${rows.join('\n')}
 */`
}

const getDefaultOrderBy = (modelName: string) => {
	const lower = modelName.charAt(0).toLowerCase() + modelName.slice(1)
	return `const defaultOrderBy = (
	params: z.infer<typeof ${lower}FilterSchema>
): Prisma.${modelName}OrderByWithRelationInput => ({
	// Modify as needed (e.g., use 'updatedAt' if available)
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
	const defaultIncludeObj = relationFields.length
		? `{\n  ${relationFields.map((r) => `${r}: true`).join(',\n  ')}\n}`
		: '{}'

	const defaultOrderBy = getDefaultOrderBy(modelName)

	return `import { Prisma } from '@/prisma/client';
import { prisma } from '@/services/db';
import { build${modelName}Filters, ${lower}FilterSchema } from '@/services/filters/${lower}.filters';
import { searchFactory } from '@/utils/search';
import type { IRepository } from './IRepository';
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import type { z } from 'zod'

const defaultInclude = ${defaultIncludeObj};
${defaultOrderBy};
type ModelWithRelations = Prisma.${modelName}GetPayload<{ include: typeof defaultInclude }>;

export class ${modelName}Repository implements IRepository<ModelWithRelations, '${modelName}'> {
	name = '${modelName}' as const;
	private db: typeof prisma;
	private search;

	constructor(dbClient: typeof prisma) {
		this.db = dbClient;
		this.search = searchFactory(
			this.db.${lower},
			build${modelName}Filters,
			defaultInclude,
			defaultOrderBy
		);
	}

	// --- Basic CRUD ---

	async findById(id: string): Promise<ModelWithRelations | null> {
		return this.db.${lower}.findUnique({
			where: { id },
			include: defaultInclude,
		});
	}

	async findAll(args?: Prisma.${modelName}FindManyArgs): Promise<ModelWithRelations[]> {
		return this.db.${lower}.findMany({
			...args,
			include: defaultInclude,
		});
	}

	async create(data: Prisma.${modelName}CreateInput): Promise<ModelWithRelations> {
		return this.db.${lower}.create({
			data:{
                ...data,
                id: toObjectId(getPrefixForModel('${modelName}'))
            },
			include: defaultInclude,
		});
	}

	async update(args: Prisma.${modelName}UpdateArgs): Promise<ModelWithRelations> {
		return this.db.${lower}.update({
            ...args,
			include: defaultInclude,
		});
	}

	async delete(id: string): Promise<ModelWithRelations> {
		return this.db.${lower}.delete({
			where: { id },
			include: defaultInclude,
		});
	}

	// --- Custom Methods ---

	// Example:
	// async findByEmail(email: string): Promise<ModelWithRelations | null> {
	//   return this.db.${lower}.findUnique({ where: { email }, include: defaultInclude });
	// }
}

// Export a singleton instance
export const ${lower}Repository = new ${modelName}Repository(prisma);
`
}

// --- Main Execution ---

async function main() {
	// 1. Get model name
	const { modelName } = await inquirer.prompt<{ modelName: string }>([
		{
			type: 'input',
			name: 'modelName',
			message: 'Enter the Prisma model name (e.g., User, Item):',
			validate: (s) => !!s.trim() || 'Model name is required',
		},
	])

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
	const repoFile = `${modelName}Repository.ts`
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
		`ℹ️  Relations found: ${
			parsedFields.relationFields.join(', ') || '(none)'
		}`
	)
	console.log(`ℹ️  Docs format: ${options.format.toUpperCase()}`)
}

main().catch((error) => {
	console.error('An error occurred:', error)
	process.exit(1)
})
