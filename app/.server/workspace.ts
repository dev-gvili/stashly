import { itemRepository } from "./repositories/ItemRepository"

export async function getWorkspaceItems(workspaceId: string) {
  // The complex query is now handled by the repository.
  // The service layer is clean and easy to read.
  return await itemRepository.findByWorkspace(workspaceId);
}