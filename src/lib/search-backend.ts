/**
 * TECH-05: Search backend abstraction.
 *
 * Today: Postgres ILIKE-driven search via existing actions/search.ts.
 * Future: swap to Meilisearch or Typesense behind the same interface.
 *
 * Each adapter must implement the SearchBackend interface. Selection is via
 * env `SEARCH_BACKEND` (default `postgres`).
 */

export interface SearchHit {
    id: string;
    slug: string;
    title: string;
    score?: number;
}

export interface SearchBackend {
    name: string;
    query(opts: { q: string; limit?: number; offset?: number }): Promise<SearchHit[]>;
    indexProduct?(product: { id: string; title: string; description: string | null; brand: string | null }): Promise<void>;
    deleteProduct?(productId: string): Promise<void>;
}

class PostgresFallback implements SearchBackend {
    name = "postgres";
    async query(): Promise<SearchHit[]> {
        // The existing app surfaces use `actions/search.ts` directly; this adapter
        // is a placeholder pointer so consumers can compile-time depend on the
        // interface without yet rerouting the search action.
        return [];
    }
}

let singleton: SearchBackend | null = null;

export function getSearchBackend(): SearchBackend {
    if (!singleton) {
        const driver = process.env.SEARCH_BACKEND ?? "postgres";
        // INFRA TODO (TECH-05): instantiate MeilisearchAdapter when driver === "meilisearch"
        // or TypesenseAdapter when driver === "typesense", reading host/keys from env.
        if (driver !== "postgres") {
            // eslint-disable-next-line no-console
            console.warn(`[search-backend] driver "${driver}" not yet implemented, falling back to postgres`);
        }
        singleton = new PostgresFallback();
    }
    return singleton;
}
