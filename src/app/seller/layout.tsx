import { SellerSidebar } from "@/components/seller/SellerSidebar";
import { getSellerProfileByUserId } from "@/actions/seller";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SellerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const sellerProfile = await getSellerProfileByUserId(session.user.id);
    const hasSellerProfile = Boolean(sellerProfile?.store_name && sellerProfile?.store_slug);

    if (!hasSellerProfile) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
                <main className="max-w-5xl mx-auto px-4 py-10">
                    {children}
                </main>
            </div>
        );
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
