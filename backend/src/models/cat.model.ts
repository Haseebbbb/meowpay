export interface Cat {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  balance: number;
  created_at: Date;
  updated_at: Date;
}

export interface NewCat {
  name: string;
  email: string;
  password_hash: string;
  balance: number;
}

// Public projection used by search results — never includes password_hash.
export interface CatSummary {
  id: string;
  name: string;
  email: string;
}

export interface MeResult {
  id: string;
  name: string;
  email: string;
  balance: number;
}
