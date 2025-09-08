import { z } from 'zod'

const categories = z.enum([
	'video',
	'audio',
	'image',
	'document',
	'spreadsheet',
	'presentation',
	'pdf',
	'archive',
	'script',
	'executable',
	'code',
	'graphic',
	'none',
])
const items = z.enum([
	'video',
	'audio',
	'image',
	'folder',
	'file',
	'collection',
	'photo',
])
const roles = z.enum(['viewer', 'member', 'admin', 'owner'])
export { categories, items, roles }
