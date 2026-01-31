import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function CheckoutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Protect checkout route - must be logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    return <>{children}</>;
}
