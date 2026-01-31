import { ProfileSidebar } from "@/components/profile/ProfileSidebar";

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="layout-container flex h-full grow flex-col md:flex-row max-w-[1440px] mx-auto w-full">
            <ProfileSidebar />
            <main className="flex-1 flex flex-col p-4 md:p-8 lg:px-12 w-full max-w-[1000px]">
                {children}
            </main>
        </div>
    );
}
