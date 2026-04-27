import { listFeeRules } from "@/actions/fees";
import { getCategories } from "@/actions/categories";
import FeeRulesClient from "./FeeRulesClient";

export const dynamic = "force-dynamic";

export default async function AdminFeesPage() {
    const [rules, categories] = await Promise.all([listFeeRules(), getCategories()]);

    const serializedRules = rules.map((r) => ({
        id: r.id,
        name: r.name,
        scope_category_id: r.scope_category_id,
        scope_seller_tier: r.scope_seller_tier,
        valid_from: r.valid_from.toISOString(),
        valid_to: r.valid_to ? r.valid_to.toISOString() : null,
        priority: r.priority,
        is_active: r.is_active,
        mode: r.mode,
        default_value: Number(r.default_value),
        brackets: r.brackets.map((b) => ({
            id: b.id,
            min_price: Number(b.min_price),
            max_price: b.max_price === null ? null : Number(b.max_price),
            value: Number(b.value),
            value_mode: b.value_mode,
        })),
    }));

    const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Aturan Biaya Platform
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Konfigurasi biaya platform berdasarkan kategori, rentang harga, dan tier seller. Setiap order
                        snapshot rule yang aktif sehingga perubahan tidak retroaktif.
                    </p>
                </div>

                <FeeRulesClient initialRules={serializedRules} categories={categoryOptions} />
            </div>
        </div>
    );
}
