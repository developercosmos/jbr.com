import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — JUALBELIRAKET.COM",
  description:
    "Kebijakan privasi JUALBELIRAKET.COM mengenai pengumpulan, penggunaan, dan perlindungan data pengguna.",
};

export default function PrivacyPage() {
  return (
    <main className="w-full max-w-3xl mx-auto px-4 py-12 text-slate-700">
      <nav className="text-sm text-slate-500 mb-6">
        <Link href="/" className="hover:underline">
          Beranda
        </Link>
        <span className="mx-2">/</span>
        <span>Kebijakan Privasi</span>
      </nav>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Kebijakan Privasi
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Berlaku efektif: 28 April 2026
      </p>

      <section className="space-y-6 leading-relaxed">
        <p>
          JUALBELIRAKET.COM menghormati privasi pengguna. Kebijakan ini
          menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi
          informasi Anda.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          1. Informasi yang Dikumpulkan
        </h2>
        <p>
          Kami mengumpulkan informasi yang Anda berikan saat mendaftar
          (nama, email, nomor telepon, alamat) serta data transaksi dan
          interaksi platform.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          2. Penggunaan Informasi
        </h2>
        <p>
          Informasi digunakan untuk memproses transaksi, mengirim pemberitahuan
          terkait pesanan, mencegah penipuan, dan meningkatkan layanan.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          3. Berbagi Data
        </h2>
        <p>
          Kami tidak menjual data pribadi Anda. Data dapat dibagikan kepada
          mitra logistik, pembayaran, dan otoritas hukum hanya sebatas yang
          diperlukan untuk menjalankan layanan atau memenuhi kewajiban hukum.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          4. Keamanan Data
        </h2>
        <p>
          Kami menerapkan langkah teknis dan organisasi untuk melindungi data
          dari akses yang tidak sah, termasuk enkripsi pada lalu lintas dan
          penyimpanan kredensial.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          5. Hak Pengguna
        </h2>
        <p>
          Anda berhak mengakses, mengoreksi, atau meminta penghapusan data
          pribadi Anda sesuai peraturan yang berlaku.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          6. Cookie
        </h2>
        <p>
          Kami menggunakan cookie untuk menjaga sesi login dan menganalisis
          penggunaan platform. Anda dapat menonaktifkan cookie melalui
          pengaturan peramban.
        </p>

        <h2 className="text-xl font-semibold text-slate-900 pt-4">
          7. Kontak
        </h2>
        <p>
          Pertanyaan terkait privasi dapat dikirim ke{" "}
          <a
            href="mailto:privacy@jualbeliraket.com"
            className="text-brand-primary hover:underline"
          >
            privacy@jualbeliraket.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
