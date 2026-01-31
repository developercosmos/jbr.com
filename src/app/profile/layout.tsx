import { ProfileSidebar } from "@/components/profile/ProfileSidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Protect profile routes - must be logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    return (
        <div className="layout-container flex h-full grow flex-col md:flex-row max-w-[1440px] mx-auto w-full">
            <ProfileSidebar />
            <main className="flex-1 flex flex-col p-4 md:p-8 lg:px-12 w-full max-w-[1000px]">
                {children}
            </main>
        </div>
    );
}
