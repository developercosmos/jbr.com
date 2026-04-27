/**
 * TECH-05: Search backend abstraction.
 *
 * Today: PostgresFallback (no-op stub; existing actions/search.ts continues
 * to serve traffic via direct Drizzle queries).
 * When SEARCH_BACKEND=meilisearch + MEILISEARCH_HOST + MEILISEARCH_API_KEY
 * are set, MeilisearchAdapter takes over with full-text + faceted search.
 *
 * Switching the live search action to use this adapter is a follow-up; the
 * abstraction lets that swap happen without touching every call site.
 */

import { logger } from "@/lib/logger";

export interface SearchHit {
    id: string;
    slug: string;
    title: string;
    score?: number;
}

export interface IndexableProduct {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    brand: string | null;
    price: string | number;
    weightClass?: string | null;
    balance?: string | null;
    shaftFlex?: string | null;
    gripSize?: string | null;
}

export interface SearchBackend {
    name: string;
    query(opts: { q: string; limit?: number; offset?: number; filters?: Record<string, string | string[]> }): Promise<SearchHit[]>;
    indexProduct?(product: IndexableProduct): Promise<void>;
    deleteProduct?(productId: string): Promise<void>;
    bulkIndex?(products: IndexableProduct[]): Promise<void>;
}

const PRODUCTS_INDEX = "products";

class PostgresFallback implements SearchBackend {
    name = "postgres";
    async query(): Promise<SearchHit[]> {
        // Stub: real Postgres search lives in actions/search.ts. This adapter
        // exists so callers can compile against the interface uniformly.
        return [];
    }
}

class MeilisearchAdapter implements SearchBackend {
    name = "meilisearch";
    private clientPromise: Promise<import("meilisearch").Meilisearch> | null = null;

    constructor(private host: string, private apiKey: string) {}

    private async client() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                const { Meilisearch } = await import("meilisearch");
                return new Meilisearch({ host: this.host, apiKey: this.apiKey });
            })();
        }
        return this.clientPromise;
    }

    async query(opts: {
        q: string;
        limit?: number;
        offset?: number;
        filters?: Record<string, string | string[]>;
    }): Promise<SearchHit[]> {
        try {
            const c = await this.client();
            const filterParts: string[] = [];
            if (opts.filters) {
                for (const [k, v] of Object.entries(opts.filters)) {
                    if (Array.isArray(v)) {
                        filterParts.push(`${k} IN [${v.map((s) => JSON.stringify(s)).join(", ")}]`);
                    } else if (v) {
                        filterParts.push(`${k} = ${JSON.stringify(v)}`);
                    }
                }
            }
            const result = await c.index(PRODUCTS_INDEX).search(opts.q, {
                limit: opts.limit ?? 24,
                offset: opts.offset ?? 0,
                filter: filterParts.length > 0 ? filterParts : undefined,
            });
            return (result.hits as Array<{ id: string; slug: string; title: string }>).map((h) => ({
                id: h.id,
                slug: h.slug,
                title: h.title,
            }));
        } catch (error) {
            logger.error("search:meilisearch_query_failed", { error: String(error) });
            return [];
        }
    }

    async indexProduct(product: IndexableProduct): Promise<void> {
        try {
            const c = await this.client();
            await c.index(PRODUCTS_INDEX).addDocuments([
                {
                    id: product.id,
                    slug: product.slug,
                    title: product.title,
                    description: product.description ?? "",
                    brand: product.brand ?? "",
                    price: Number(product.price),
                    weightClass: product.weightClass ?? null,
                    balance: product.balance ?? null,
                    shaftFlex: product.shaftFlex ?? null,
                    gripSize: product.gripSize ?? null,
                },
            ]);
        } catch (error) {
            logger.error("search:meilisearch_index_failed", { productId: product.id, error: String(error) });
        }
    }

    async deleteProduct(productId: string): Promise<void> {
        try {
            const c = await this.client();
            await c.index(PRODUCTS_INDEX).deleteDocument(productId);
        } catch (error) {
            logger.error("search:meilisearch_delete_failed", { productId, error: String(error) });
        }
    }

    async bulkIndex(products: IndexableProduct[]): Promise<void> {
        try {
            const c = await this.client();
            await c.index(PRODUCTS_INDEX).addDocuments(
                products.map((p) => ({
                    id: p.id,
                    slug: p.slug,
                    title: p.title,
                    description: p.description ?? "",
                    brand: p.brand ?? "",
                    price: Number(p.price),
                    weightClass: p.weightClass ?? null,
                    balance: p.balance ?? null,
                    shaftFlex: p.shaftFlex ?? null,
                    gripSize: p.gripSize ?? null,
                }))
            );
        } catch (error) {
            logger.error("search:meilisearch_bulk_index_failed", { count: products.length, error: String(error) });
        }
    }
}

let singleton: SearchBackend | null = null;

export function getSearchBackend(): SearchBackend {
    if (!singleton) {
        const driver = process.env.SEARCH_BACKEND ?? "postgres";
        if (driver === "meilisearch") {
            const host = process.env.MEILISEARCH_HOST;
            const apiKey = process.env.MEILISEARCH_API_KEY;
            if (host && apiKey) {
                singleton = new MeilisearchAdapter(host, apiKey);
                logger.info("search:driver_selected", { driver: "meilisearch", host });
            } else {
                logger.warn("search:meilisearch_missing_env", {});
                singleton = new PostgresFallback();
            }
        } else {
            singleton = new PostgresFallback();
        }
    }
    return singleton;
}
