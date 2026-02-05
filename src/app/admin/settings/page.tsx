import { Settings, CreditCard, Mail, Truck, Globe } from "lucide-react";
import { getIntegrationSettings, seedDefaultIntegrations } from "@/actions/settings";
import { getEnvSettings } from "@/actions/env-settings";
import { IntegrationCard } from "./IntegrationCard";
import { SeedButton } from "./SeedButton";
import { SystemSettings } from "./SystemSettings";

const categoryIcons: Record<string, React.ReactNode> = {
    general: <Globe className="w-5 h-5" />,
    payment: <CreditCard className="w-5 h-5" />,
    email: <Mail className="w-5 h-5" />,
    shipping: <Truck className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
    general: "Pengaturan Umum",
    payment: "Payment Gateway",
    email: "Email Service",
    shipping: "Shipping Aggregator",
};

export default async function AdminSettingsPage() {
    const [integrations, envSettings] = await Promise.all([
        getIntegrationSettings(),
        getEnvSettings(),
    ]);

    // Group by category
    const groupedIntegrations = integrations.reduce((acc, integration) => {
        if (!acc[integration.category]) {
            acc[integration.category] = [];
        }
        acc[integration.category].push(integration);
        return acc;
    }, {} as Record<string, typeof integrations>);

    const hasNoIntegrations = integrations.length === 0;

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase flex items-center gap-3">
                            <Settings className="w-8 h-8 text-brand-primary" />
                            Pengaturan
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola pengaturan sistem, integrasi payment, email, dan shipping.
                        </p>
                    </div>
                </div>

                {/* System Settings (Environment Variables) */}
                <SystemSettings initialSettings={envSettings} />

                {/* Seed Button if no integrations */}
                {hasNoIntegrations && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
                        <p className="text-blue-700 dark:text-blue-300 mb-4">
                            Belum ada integrasi yang dikonfigurasi. Klik tombol di bawah untuk menambahkan integrasi default.
                        </p>
                        <SeedButton />
                    </div>
                )}

                {/* Integration Categories */}
                {Object.entries(groupedIntegrations).map(([category, items]) => (
                    <div key={category} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                                {categoryIcons[category]}
                            </div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {categoryLabels[category] || category}
                            </h2>
                        </div>
                        <div className="space-y-4">
                            {items.map((integration) => (
                                <IntegrationCard key={integration.id} integration={integration} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
