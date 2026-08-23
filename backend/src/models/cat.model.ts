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
