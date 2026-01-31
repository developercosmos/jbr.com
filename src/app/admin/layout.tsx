import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let session;
    try {
        session = await auth.api.getSession({ headers: await headers() });
    } catch (error) {
        console.error("AdminLayout Auth Error:", error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <div className="text-red-600 p-4 bg-white rounded shadow">
                    <h2 className="font-bold mb-2">Authentication Error</h2>
                    <p className="font-mono text-sm">{String(error)}</p>
                </div>
            </div>
        );
    }

    if (!session?.user) {
        redirect("/auth/login");
    }

    let user;
    try {
        user = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
        });
    } catch (error) {
        console.error("AdminLayout DB Error:", error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <div className="text-red-600 p-4 bg-white rounded shadow">
                    <h2 className="font-bold mb-2">Authorization Check Error</h2>
                    <p className="font-mono text-sm">{String(error)}</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== "ADMIN") {
        redirect("/");
    }

    return (
        <div className="flex min-h-screen bg-[#F8F9FB] dark:bg-background-dark font-sans">
            <AdminSidebar />
            <main className="flex-1 flex flex-col relative">
                {children}
            </main>
        </div>
    );
}
