import { SellerSidebar } from "@/components/seller/SellerSidebar";

export default function SellerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display">
            <SellerSidebar />
            <main className="flex-1 flex flex-col relative">
                {children}
            </main>
        </div>
    );
}
