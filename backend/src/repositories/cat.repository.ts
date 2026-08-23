import { db } from '../config/database';
import type { Cat, NewCat } from '../models';

export const catRepository = {
  async findByEmail(email: string): Promise<Cat | null> {
    const cat = await db<Cat>('cats').where({ email }).first();
    return cat ?? null;
  },

  async create(data: NewCat): Promise<Cat> {
    const [cat] = await db<Cat>('cats').insert(data).returning('*');

    if (!cat) {
      throw new Error('Insert into cats returned no row');
    }

    return cat;
  },
};
