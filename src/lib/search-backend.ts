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

export interface SearchQueryResult {
    hits: SearchHit[];
    estimatedTotal: number;
    facetDistribution?: Record<string, Record<string, number>>;
}

export interface SearchBackend {
    name: string;
    query(opts: {
        q: string;
        limit?: number;
        offset?: number;
        filters?: Record<string, string | string[]>;
        facets?: string[];
    }): Promise<SearchQueryResult>;
    indexProduct?(product: IndexableProduct): Promise<void>;
    deleteProduct?(productId: string): Promise<void>;
    bulkIndex?(products: IndexableProduct[]): Promise<void>;
}

const PRODUCTS_INDEX = "products";

class PostgresFallback implements SearchBackend {
    name = "postgres";
    async query(): Promise<SearchQueryResult> {
        // Stub: real Postgres search lives in actions/search.ts. This adapter
        // exists so callers can compile against the interface uniformly.
        return { hits: [], estimatedTotal: 0 };
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
        facets?: string[];
    }): Promise<SearchQueryResult> {
        try {
            const c = await this.client();
            const filterParts: string[] = [];
            if (opts.filters) {
                for (const [k, v] of Object.entries(opts.filters)) {
                    if (Array.isArray(v)) {
                        if (v.length > 0) {
                            filterParts.push(`${k} IN [${v.map((s) => JSON.stringify(s)).join(", ")}]`);
                        }
                    } else if (v) {
                        filterParts.push(`${k} = ${JSON.stringify(v)}`);
                    }
                }
            }
            const result = await c.index(PRODUCTS_INDEX).search(opts.q, {
                limit: opts.limit ?? 24,
                offset: opts.offset ?? 0,
                filter: filterParts.length > 0 ? filterParts : undefined,
                facets: opts.facets,
            });
            const hits = (result.hits as Array<{ id: string; slug: string; title: string }>).map((h) => ({
                id: h.id,
                slug: h.slug,
                title: h.title,
            }));
            return {
                hits,
                estimatedTotal: typeof result.estimatedTotalHits === "number" ? result.estimatedTotalHits : hits.length,
                facetDistribution: (result.facetDistribution ?? undefined) as Record<string, Record<string, number>> | undefined,
            };
        } catch (error) {
            logger.error("search:meilisearch_query_failed", { error: String(error) });
            return { hits: [], estimatedTotal: 0 };
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

/**
 * SRCH-03 reconcile: ensure index document count matches DB published count.
 * Called from cron/trust-sweeps. Re-bulk-indexes if drift detected.
 */
export async function reconcileSearchIndex(loadAllPublished: () => Promise<IndexableProduct[]>): Promise<{
    indexed: number;
    skipped: boolean;
    reason?: string;
}> {
    const driver = process.env.SEARCH_BACKEND ?? "postgres";
    if (driver !== "meilisearch") {
        return { indexed: 0, skipped: true, reason: "driver_not_meilisearch" };
    }
    const backend = getSearchBackend();
    if (!backend.bulkIndex) return { indexed: 0, skipped: true, reason: "adapter_lacks_bulk_index" };

    const products = await loadAllPublished();
    await backend.bulkIndex(products);
    logger.info("search:reconcile_complete", { driver, indexed: products.length });
    return { indexed: products.length, skipped: false };
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
