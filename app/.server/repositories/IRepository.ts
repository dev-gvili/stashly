export interface IRepository<T> {
  findById(id: number | string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: number | string, data: any): Promise<T>;
  delete(id: number | string): Promise<T>;
}