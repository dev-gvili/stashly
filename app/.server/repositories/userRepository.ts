import { Prisma } from '@/prisma/client';
import { prisma } from '@/services/db';
import { buildUserFilters, userFilterSchema } from '../filters/user.filters';
import { searchFactory } from '@/utils/search';
import type { IRepository } from './IRepository';
import type { z } from 'zod'

const defaultInclude = {
  notifications: true,
  permissions: true,
  accounts: true,
  sessions: true,
  workspaces: true,
  subscriptions: true,
  comments: true,
  invitations: true,
  items: true,
  lockedItems: true,
  drive: true,
  favorites: true
};
type ModelWithRelations = Prisma.UserGetPayload<{ include: typeof defaultInclude }>;
const defaultOrderBy = (
	params: z.infer<typeof userFilterSchema>
): Prisma.UserOrderByWithRelationInput => ({
	updatedAt: 'desc',
})
export class UserRepository implements IRepository<ModelWithRelations, 'User'> {
	name = 'User' as const;
	private db: typeof prisma;
	public search

	constructor(dbClient: typeof prisma = prisma) {
		this.db = dbClient;
		this.search = searchFactory({
			dbDelegate: this.db.user,
			buildFilters: buildUserFilters,
			defaultOrderBy
		});
	}

	// ------------------------------------------------------------------
	// Basic CRUD
	// ------------------------------------------------------------------

	async findById(id: string): Promise<ModelWithRelations | null> {
		return this.db.user.findUnique({
			where: { id },
			include: defaultInclude,
		});
	}

	async findAll(args?: Prisma.UserFindManyArgs): Promise<ModelWithRelations[]> {
		return this.db.user.findMany({
			...args,
			include: defaultInclude,
		});
	}

	async create(data: Prisma.UserCreateInput): Promise<ModelWithRelations> {
		return this.db.user.create({
			data,
			include: defaultInclude,
		});
	}

	async update(args: Prisma.UserUpdateArgs): Promise<ModelWithRelations> {
		return this.db.user.update({
			...args,
			include: defaultInclude,
		});
	}

	async delete(id: string): Promise<ModelWithRelations> {
		return this.db.user.delete({
			where: { id },
			include: defaultInclude,
		});
	}

	// ------------------------------------------------------------------
	// Custom Methods
	// ------------------------------------------------------------------

	// Add custom data access methods here.
	// Example:
	// async findByEmail(email: string): Promise<ModelWithRelations | null> {
	//   return this.db.user.findUnique({
	//     where: { email },
	//     include: defaultInclude,
	//   });
	// }
}

// Export a singleton instance of the repository.
export const userRepository = new UserRepository(prisma);
