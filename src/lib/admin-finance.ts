import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AdminSession {
    userId: string;
    name: string | null;
    email: string | null;
}

/**
 * Page/route guard for /admin/finance/*. Redirects non-admins to "/".
 */
export async function requireAdminFinanceSession(): Promise<AdminSession> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?redirect=/admin/finance");
    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, name: true, email: true, role: true },
    });
    if (!user || user.role !== "ADMIN") redirect("/");
    return { userId: user.id, name: user.name ?? null, email: user.email ?? null };
}
