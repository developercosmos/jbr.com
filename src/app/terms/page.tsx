import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — JUALBELIRAKET.COM",
  description:
    "Syarat dan ketentuan penggunaan platform JUALBELIRAKET.COM untuk pembeli dan penjual.",
};

export default function TermsPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-12 text-slate-700">
      <nav className="text-sm text-slate-500 mb-6">
        <Link href="/" className="hover:underline">
          Beranda
        </Link>
        <span className="mx-2">/</span>
        <span>Syarat &amp; Ketentuan</span>
      </nav>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Syarat &amp; Ketentuan
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Berlaku efektif: 28 April 2026
      </p>

      <section className="space-y-6 leading-relaxed">
        <p>
          Selamat datang di JUALBELIRAKET.COM. Dengan mengakses atau menggunakan
          platform kami, Anda menyetujui Syarat &amp; Ketentuan berikut. Mohon
          membaca dengan saksama sebelum melakukan transaksi.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          1. Akun Pengguna
        </h2>
        <p>
          Pengguna wajib memberikan informasi yang akurat saat mendaftar dan
          bertanggung jawab atas keamanan kredensial akun masing-masing.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          2. Daftar Produk &amp; Penjual
        </h2>
        <p>
          Penjual bertanggung jawab atas keaslian, kondisi, dan deskripsi produk
          yang dijual. Produk palsu, ilegal, atau tidak sesuai deskripsi akan
          dihapus dan akun penjual dapat ditangguhkan.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          3. Transaksi &amp; Pembayaran
        </h2>
        <p>
          Pembayaran diproses melalui penyedia pembayaran resmi. Dana pembeli
          ditahan hingga pesanan dikonfirmasi diterima atau periode escrow
          berakhir.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          4. Pengembalian &amp; Sengketa
        </h2>
        <p>
          Pembeli berhak mengajukan sengketa dalam batas waktu yang ditentukan
          jika produk yang diterima tidak sesuai. Tim JUALBELIRAKET.COM akan
          memediasi sesuai kebijakan yang berlaku.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          5. Larangan
        </h2>
        <p>
          Pengguna dilarang menggunakan platform untuk aktivitas penipuan,
          spam, pencucian uang, atau pelanggaran hukum lainnya.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          6. Perubahan Ketentuan
        </h2>
        <p>
          Kami dapat memperbarui Syarat &amp; Ketentuan ini sewaktu-waktu.
          Perubahan akan diberitahukan melalui platform dan berlaku setelah
          dipublikasikan.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          7. Kontak
        </h2>
        <p>
          Pertanyaan terkait ketentuan ini dapat dikirim ke{" "}
          <a
            href="mailto:support@jualbeliraket.com"
            className="text-brand-primary hover:underline"
          >
            support@jualbeliraket.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
