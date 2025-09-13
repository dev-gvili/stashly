import crypto from 'crypto-js'
import  { Prisma } from '@/prisma/client'
import type { z } from 'zod'

/**
 * this function take any number of functions with any number of arguments and run them one by one
 * @param fns any number of functions
 * @returns void
 */
export const callAll =
	(...fns: any[]) =>
	(...args: any[]) => {
		return fns.forEach((fn) => typeof fn === 'function' && fn(...args))
	}

/**
 * A type representing the common Stripe object types derived from their ID prefixes.
 */
export type StashlyObjectType = Prisma.ModelName

// A map to convert stashly ID prefixes to their full object type names based on StashlyObjectType

/**
 * A mapping from the full model name to a short, unique prefix.
 * This is used when generating a new ID to get the correct prefix for a given model.
 * The keys are strongly typed to values from the ModelName object.
 */
export const StashlyPrefixMap = {
	Account: 'acc',
	ItemAction: 'ia',
	AccessAction: 'aa',
	CommentAction: 'ca',
	CreateAction: 'cra',
	DeleteAction: 'dela',
	EditAction: 'ea',
	MoveAction: 'mva',
	CopyAction: 'cpa',
	RenameAction: 'rna',
	RestoreAction: 'rsa',
	ShareAction: 'sha',
	VersionAction: 'va',
	Activity: 'act',
	ActivityTime: 'at',
	AuditLog: 'aud',
	Collection: 'coll',
	CollectionItem: 'ci',
	Comment: 'cmt',
	Drive: 'drv',
	File: 'file',
	Folder: 'fld',
	Image: 'img',
	Video: 'vid',
	Audio: 'ado',
	Photo: 'pht',
	Favorite: 'fav',
	Invitation: 'inv',
	Item: 'item',
	LockedItem: 'li',
	Metadata: 'meta',
	Notification: 'ntf',
	Permission: 'perm',
	Quota: 'qot',
	Search: 'srch',
	Session: 'sess',
	ShareLink: 'sl',
	StoragePlan: 'sp',
	Subscription: 'sub',
	Tag: 'tag',
	Thumbnail: 'thumb',
	Trash: 'trsh',
	TrashItem: 'ti',
	User: 'usr',
	Verification: 'ver',
	ItemVersion: 'iv',
	Workspace: 'ws',
	WorkspaceMember: 'wm',
	Preview: 'prv',
	FileShare: 'fs',
	View: 'view',
} as const

/**
 * A union type representing all possible prefix strings.
 * Using this type in function signatures provides autocompletion and prevents
 * the use of invalid prefixes.
 *
 * Example: `function generateId(prefix: ModelPrefix) { ... }`
 */
export type StashlyObjectPrefix =
	(typeof StashlyPrefixMap)[keyof typeof StashlyPrefixMap]

// --- Example Usage ---

const models = Object.keys(Prisma.ModelName) as (keyof typeof Prisma.ModelName)[]

export function getPrefixForModel(objectType: keyof typeof StashlyPrefixMap) {
	return StashlyPrefixMap[objectType] as StashlyObjectPrefix
}

/**
 * Generates a unique, cryptographically secure ID in a Stripe-like format.
 *
 * The ID is composed of a prefix, an underscore, and a 20-character URL-safe
 * alphanumeric string.
 *
 * @param {string} prefix The short, descriptive prefix for the ID (e.g., 'cus', 'sub', 'pi').
 */
export function toObjectId(prefix: StashlyObjectPrefix) {
	if (!prefix || typeof prefix !== 'string' || prefix.includes('_')) {
		throw new Error(
			'Invalid prefix: must be a non-empty string without an underscore.'
		)
	}

	const randomString = crypto.lib.WordArray.random(16)
		.toString(crypto.enc.Base64)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')

	return `${prefix}_${randomString}`
}
