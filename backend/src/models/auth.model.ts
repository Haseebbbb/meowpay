// Subset of a Cat that's safe to expose to clients and to embed in a JWT payload.
export interface AuthenticatedCat {
  id: string;
  name: string;
  email: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  cat: AuthenticatedCat;
}
