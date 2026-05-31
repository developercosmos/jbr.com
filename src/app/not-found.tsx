import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            <p className="text-5xl font-black text-brand-primary">404</p>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                Halaman tidak ditemukan
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-500">
                Halaman yang Anda cari tidak ada atau sudah dipindahkan.
            </p>
            <Link
                href="/"
                className="mt-6 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
            >
                Kembali ke Beranda
            </Link>
        </div>
    );
}
