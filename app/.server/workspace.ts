import { itemRepository } from './repositories/ItemRepository'

/**
 * Get all items in a workspace.
 * @param workspaceId - The ID of the workspace.
 * @returns A list of items in the workspace.
 * @remarks
 * This function retrieves all items associated with the specified workspace.
 * It leverages the itemRepository to perform the database query.
 * @example
 * ```ts
 * const items = await getWorkspaceItems("workspace123");
 * console.log(items);
 * ```
 * @throws Will throw an error if the workspaceId is invalid or if there is a database issue.
 * @see itemRepository.findWorkspaceItems for the underlying data access method.
 */
export async function getWorkspaceItems(workspaceId: string) {
  // The complex query is now handled by the repository.
  // The service layer is clean and easy to read.
  return await itemRepository.findWorkspaceItems(workspaceId)
}
