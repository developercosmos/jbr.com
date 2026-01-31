import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-[#F8F9FB] dark:bg-background-dark font-sans">
            <AdminSidebar />
            <main className="flex-1 flex flex-col relative">
                {children}
            </main>
        </div>
    );
}
