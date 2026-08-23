import { MIN_SEARCH_QUERY_LENGTH, SEARCH_RESULT_LIMIT } from '../constants/cat.constants';
import { HttpError } from '../middleware/http-error';
import type { CatSummary, MeResult } from '../models';
import { catRepository } from '../repositories/cat.repository';

export const catService = {
  async search(query: string, excludeCatId: string): Promise<CatSummary[]> {
    const trimmed = query.trim();

    // Avoid dumping the whole table on a near-empty query.
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
      return [];
    }

    return catRepository.search(trimmed, excludeCatId, SEARCH_RESULT_LIMIT);
  },

  async getMe(catId: string): Promise<MeResult> {
    const cat = await catRepository.findById(catId);

    if (!cat) {
      throw HttpError.notFound('Cat not found');
    }

    return { id: cat.id, name: cat.name, email: cat.email, balance: cat.balance };
  },
};
