import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { Categories } from "@/components/home/Categories";
import { ProductGrid } from "@/components/home/ProductGrid";
import { TrustSection } from "@/components/home/TrustSection";
import { PersonalizedSection } from "@/components/home/PersonalizedSection";
import { RecentlyViewedStrip } from "@/components/RecentlyViewedStrip";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="w-full max-w-[1440px] mx-auto pb-20">
      <Hero />
      <Categories />
      {/* Personalized recommendations ("Cocok untuk Anda") — REC-01. Was built but
          never mounted; renders its own empty/profile-prompt state when relevant. */}
      <Suspense fallback={null}>
        <PersonalizedSection />
      </Suspense>
      {/* Recently-viewed strip — self-hydrates from localStorage + server data. */}
      <RecentlyViewedStrip />
      <Suspense fallback={
        <div className="py-24 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-slate-400">Loading recommendations...</p>
        </div>
      }>
        <ProductGrid />
      </Suspense>
      <TrustSection />
    </main>
  );
}
