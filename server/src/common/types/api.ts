export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class Paginated<T> {
  constructor(
    readonly data: T[],
    readonly meta: ApiMeta,
  ) {}
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
