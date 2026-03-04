import { searchRepository } from './search.repository'
import { toVector } from './embeddings'

class SearchService {
  async semanticSearch(query: string, topK: number) {
    // 1. Generate embedding for the query.
    const queryVector = (await toVector(query)) as number[]

    // 2. Perform semantic search in the repository.
    const searchResults = await searchRepository.semanticSearch(
      queryVector,
      topK
    )

    return searchResults
  }
}

export const searchService = new SearchService()
