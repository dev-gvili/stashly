import { Prisma } from '@/prisma/client';
import { prisma } from '@/services/db';
import { buildWorkspaceFilters, workspaceFilterSchema } from '@/services/filters/workspace.filters';
import { searchFactory } from '@/utils/search';
import type { IRepository } from './IRepository';
import { getPrefixForModel, toObjectId } from '@/utils/misc'
import type { z } from 'zod'

const defaultInclude = {
  storagePlan: true,
  items: true,
  invitations: true,
  members: true
};
const defaultOrderBy = (
	params: z.infer<typeof workspaceFilterSchema>
): Prisma.WorkspaceOrderByWithRelationInput => ({
	// Modify as needed (e.g., use 'updatedAt' if available)
});
type ModelWithRelations = Prisma.WorkspaceGetPayload<{ include: typeof defaultInclude }>;

export class WorkspaceRepository implements IRepository<ModelWithRelations, 'Workspace'> {
	name = 'Workspace' as const;
	private db: typeof prisma;
	public search;

	constructor(dbClient: typeof prisma) {
		this.db = dbClient;
		this.search = searchFactory({
			dbDelegate: this.db.workspace,
			buildFilters: buildWorkspaceFilters,
			defaultInclude,
			defaultOrderBy
		}
		);
	}

	// --- Basic CRUD ---

	async findById(id: string): Promise<ModelWithRelations | null> {
		return this.db.workspace.findUnique({
			where: { id },
			include: defaultInclude,
		});
	}

	async findAll(args?: Prisma.WorkspaceFindManyArgs): Promise<ModelWithRelations[]> {
		return this.db.workspace.findMany({
			...args,
			include: defaultInclude,
		});
	}

	async create(data: Prisma.WorkspaceCreateInput): Promise<ModelWithRelations> {
		return this.db.workspace.create({
			data:{
                ...data,
                id: toObjectId(getPrefixForModel('Workspace'))
            },
			include: defaultInclude,
		});
	}

	async update(args: Prisma.WorkspaceUpdateArgs): Promise<ModelWithRelations> {
		return this.db.workspace.update({
            ...args,
			include: defaultInclude,
		});
	}

	async delete(id: string): Promise<ModelWithRelations> {
		return this.db.workspace.delete({
			where: { id },
			include: defaultInclude,
		});
	}

	// --- Custom Methods ---

	// Example:
	// async findByEmail(email: string): Promise<ModelWithRelations | null> {
	//   return this.db.workspace.findUnique({ where: { email }, include: defaultInclude });
	// }
}

// Export a singleton instance
export const workspaceRepository = new WorkspaceRepository(prisma);
