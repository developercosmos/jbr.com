import { Hero } from "@/components/home/Hero";
import { Categories } from "@/components/home/Categories";
import { ProductGrid } from "@/components/home/ProductGrid";
import { TrustSection } from "@/components/home/TrustSection";

export default function Home() {
  return (
    <main className="w-full max-w-[1440px] mx-auto pb-20">
      <Hero />
      <Categories />
      <ProductGrid />
      <TrustSection />
    </main>
  );
}
