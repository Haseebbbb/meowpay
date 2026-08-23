import { MIN_SEARCH_QUERY_LENGTH, SEARCH_RESULT_LIMIT } from '../constants/cat.constants';
import type { Cat } from '../models';
import { catRepository } from '../repositories/cat.repository';
import { catService } from './cat.service';

jest.mock('../repositories/cat.repository');

const searchMock = catRepository.search as jest.MockedFunction<typeof catRepository.search>;
const findByIdMock = catRepository.findById as jest.MockedFunction<typeof catRepository.findById>;

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'cat-1',
    name: 'Whiskers',
    email: 'whiskers@meowpay.dev',
    password_hash: 'stored-hash',
    balance: 500,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('catService.search', () => {
  it(`returns [] without querying the repository when the trimmed query is under ${MIN_SEARCH_QUERY_LENGTH} characters`, async () => {
    const tooShort = 'a'.repeat(MIN_SEARCH_QUERY_LENGTH - 1);

    const result = await catService.search(tooShort, 'cat-1');

    expect(result).toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('trims whitespace before checking length and before querying', async () => {
    const validQuery = 'a'.repeat(MIN_SEARCH_QUERY_LENGTH);
    searchMock.mockResolvedValue([]);

    await catService.search(`  ${validQuery}  `, 'cat-1');

    expect(searchMock).toHaveBeenCalledWith(validQuery, 'cat-1', SEARCH_RESULT_LIMIT);
  });

  it('returns whatever the repository finds for a valid query', async () => {
    const results = [{ id: 'cat-2', name: 'Simba', email: 'simba@meowpay.test' }];
    searchMock.mockResolvedValue(results);

    const result = await catService.search('sim', 'cat-1');

    expect(result).toBe(results);
  });
});

describe('catService.getMe', () => {
  it('throws 404 when the cat no longer exists', async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(catService.getMe('cat-1')).rejects.toMatchObject({ status: 404 });
  });

  it('returns id/name/email/balance without leaking password_hash', async () => {
    findByIdMock.mockResolvedValue(
      makeCat({ id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev', balance: 500 }),
    );

    const result = await catService.getMe('cat-1');

    expect(result).toEqual({ id: 'cat-1', name: 'Whiskers', email: 'whiskers@meowpay.dev', balance: 500 });
    expect(result).not.toHaveProperty('password_hash');
  });
});
