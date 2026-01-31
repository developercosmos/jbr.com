import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { Categories } from "@/components/home/Categories";
import { ProductGrid } from "@/components/home/ProductGrid";
import { TrustSection } from "@/components/home/TrustSection";
import { Package } from "lucide-react";

export default function Home() {
  return (
    <main className="w-full max-w-[1440px] mx-auto pb-20">
      <Hero />
      <Categories />
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
