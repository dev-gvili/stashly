import type { Prisma } from "../prisma/client"

export interface IRepository<T, U extends Prisma.ModelName = Prisma.ModelName> {
  name: U 
  findById(args: unknown): Promise<T | null>;
  findAll(args: unknown): Promise<T[]>;
  create(args: unknown): Promise<T>;
  update(args: unknown): Promise<T>;
  delete(args: unknown): Promise<T>;
}