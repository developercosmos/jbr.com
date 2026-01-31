import { SellerSidebar } from "@/components/seller/SellerSidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SellerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Protect seller routes - must be logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark font-display">
            <SellerSidebar />
            <main className="flex-1 flex flex-col relative">
                {children}
            </main>
        </div>
    );
}
