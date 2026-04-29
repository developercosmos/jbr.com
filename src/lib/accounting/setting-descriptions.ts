/**
 * Human-readable descriptions for accounting_settings keys shown in
 * /admin/finance/settings. Each entry has:
 *   - label   : short Indonesian title
 *   - desc    : 1–2 line explanation of what the setting controls
 *   - impact  : what changes operationally when this is updated
 *   - example : example value(s) for guidance
 */

export type SettingMeta = {
    label: string;
    desc: string;
    impact: string;
    example: string;
    /** If set, the editor renders a <select> instead of a free-text input. */
    allowedValues?: string[];
};

export const settingMeta: Record<string, SettingMeta> = {
    // ============ ENTITY ============
    "entity.legal_name": {
        label: "Nama Badan Hukum",
        desc: "Nama legal perusahaan yang dicetak pada faktur, laporan, dan ekspor pajak.",
        impact: "Muncul di header semua dokumen finance & laporan PSAK.",
        example: '"PT Jual Beli Raket"',
    },
    "entity.npwp": {
        label: "NPWP Perusahaan",
        desc: "Nomor Pokok Wajib Pajak entitas (15-digit lama atau 16-digit NIK baru).",
        impact: "Wajib untuk faktur pajak (PKP) dan ekspor Coretax.",
        example: '"01.234.567.8-901.000"',
    },
    "entity.address": {
        label: "Alamat Perusahaan",
        desc: "Alamat resmi entitas, dicetak pada invoice & laporan resmi.",
        impact: "Tampil pada faktur dan kop laporan keuangan.",
        example: '"Jl. Sudirman No. 1, Jakarta"',
    },
    "entity.fiscal_year_start_month": {
        label: "Bulan Awal Tahun Fiskal",
        desc: "Bulan pertama tahun buku (1 = Januari).",
        impact: "Menentukan kapan periode tahunan ditutup dan retained earnings di-roll over.",
        example: "1 (Jan), 4 (Apr), 7 (Jul)",
    },
    "entity.base_currency": {
        label: "Mata Uang Dasar",
        desc: "Mata uang fungsional untuk semua jurnal & laporan.",
        impact: "Semua transaksi dikonversi ke mata uang ini bila multi-currency aktif.",
        example: '"IDR"',
    },
    "entity.is_pkp": {
        label: "Status PKP",
        desc: "Apakah entitas sudah dikukuhkan sebagai Pengusaha Kena Pajak (PPN).",
        impact: "Bila true, PPN otomatis dihitung & faktur pajak diterbitkan untuk transaksi.",
        example: "true / false",
    },
    "entity.pkp_effective_from": {
        label: "PKP Berlaku Sejak",
        desc: "Tanggal efektif pengukuhan PKP. Transaksi sebelum tanggal ini tidak dipungut PPN.",
        impact: "Memengaruhi kapan PPN mulai dihitung.",
        example: '"2026-01-01" atau null',
    },
    "entity.house_seller_id": {
        label: "Akun House Seller (1P)",
        desc: "User ID seller \"house\" untuk transaksi 1P (first-party / inventory milik platform).",
        impact: "Dipakai oleh modul firstparty.* untuk mem-post COGS & inventory.",
        example: '"user_xxx" atau null',
    },

    // ============ TAX ============
    "tax.regime": {
        label: "Rezim Pajak",
        desc: "Rezim pajak yang berlaku bagi entitas: UMKM PP55 (final 0.5%), Badan reguler (22%), atau Final lainnya.",
        impact: "Menentukan tarif PPh yang dipakai di posting.",
        example: '"UMKM_PP55", "BADAN", "FINAL"',
        allowedValues: ["UMKM_PP55", "BADAN", "FINAL"],
    },
    "tax.ppn_rate": {
        label: "Tarif PPN",
        desc: "Persentase PPN sebagai desimal (0.11 = 11%, 0.12 = 12% sesuai HPP 2025).",
        impact: "Mengubah tarif PPN langsung memengaruhi journal yang dibuat setelah simpan.",
        example: "0.11 (=11%), 0.12 (=12%)",
    },
    "tax.ppn_method": {
        label: "Metode PPN",
        desc: "Apakah harga sudah termasuk PPN (INCLUSIVE) atau belum (EXCLUSIVE).",
        impact: "Memengaruhi cara PPN diekstraksi dari harga jual.",
        example: '"INCLUSIVE", "EXCLUSIVE"',
        allowedValues: ["INCLUSIVE", "EXCLUSIVE"],
    },
    "tax.pph23_rate": {
        label: "Tarif PPh Pasal 23",
        desc: "Tarif withholding PPh 23 atas jasa (umumnya 2%).",
        impact: "Dipakai bila ada potongan PPh 23 atas fee atau jasa.",
        example: "0.02 (=2%)",
    },
    "tax.pph_final_umkm_rate": {
        label: "PPh Final UMKM",
        desc: "Tarif PPh final UMKM PP-55/2022 (0.5% omzet).",
        impact: "Dipakai bila tax.regime = UMKM_PP55.",
        example: "0.005 (=0.5%)",
    },
    "tax.pph_badan_rate": {
        label: "PPh Badan",
        desc: "Tarif PPh Badan reguler (22% sesuai UU HPP).",
        impact: "Dipakai bila tax.regime = BADAN; menjadi basis estimasi pajak tangguhan.",
        example: "0.22 (=22%)",
    },
    "tax.pmse_enabled": {
        label: "PMSE Aktif",
        desc: "Apakah platform termasuk Penyelenggara PMSE yang memungut PPN PMSE.",
        impact: "Bila true, PPN PMSE dikenakan di transaksi cross-border.",
        example: "true / false",
    },
    "tax.coretax_export_format": {
        label: "Format Export Coretax",
        desc: "Format file yang digunakan saat ekspor data ke Coretax DJP.",
        impact: "Memengaruhi struktur file ekspor pajak.",
        example: '"CSV", "XML"',
        allowedValues: ["CSV", "XML"],
    },

    // ============ LOGISTICS / ESCROW / CURRENCY ============
    "logistics.revenue_mode": {
        label: "Mode Revenue Logistik",
        desc: "PASS_THROUGH (logistik tidak diakui sebagai revenue) atau MARKUP (markup diakui).",
        impact: "Menentukan apakah biaya kirim memengaruhi P&L.",
        example: '"PASS_THROUGH", "MARKUP"',
        allowedValues: ["PASS_THROUGH", "MARKUP"],
    },
    "logistics.default_markup_account_code": {
        label: "Akun Markup Logistik",
        desc: "Kode akun GL untuk markup logistik (revenue side).",
        impact: "Dipakai bila logistics.revenue_mode = MARKUP.",
        example: '"41400"',
    },
    "escrow.segregated_account": {
        label: "Escrow Terpisah",
        desc: "Apakah dana pembeli ditampung di rekening bank terpisah.",
        impact: "Dipakai untuk audit fund segregation; memengaruhi reporting kas.",
        example: "true / false",
    },
    "escrow.bank_account_id": {
        label: "Rekening Escrow",
        desc: "ID rekening bank yang ditandai sebagai escrow.",
        impact: "Dipakai untuk reconciliation rekening escrow.",
        example: '"bank_acc_xxx"',
    },
    "escrow.auto_release_days": {
        label: "Auto-release Escrow (hari)",
        desc: "Jumlah hari setelah delivery sebelum dana otomatis dilepas ke seller.",
        impact: "Memengaruhi periode uang ditahan & cashflow seller.",
        example: "7",
    },
    "currency.allow_multi": {
        label: "Multi-Currency",
        desc: "Aktifkan transaksi dalam mata uang selain base_currency.",
        impact: "Bila false, transaksi non-IDR ditolak.",
        example: "true / false",
    },
    "currency.allowed_codes": {
        label: "Mata Uang yang Diizinkan",
        desc: "Daftar kode ISO mata uang yang diperbolehkan.",
        impact: "Validasi pada saat penerimaan transaksi.",
        example: '["IDR","USD","SGD"]',
    },

    // ============ PERIOD ============
    "period.close_deadline_business_days": {
        label: "Deadline Close Period",
        desc: "Berapa hari kerja setelah akhir bulan untuk menutup periode.",
        impact: "Dipakai untuk SLA reminder & alert finance.",
        example: "5 (=hari ke-5 bulan berikutnya)",
    },
    "period.auto_lock_after_days": {
        label: "Auto-lock Setelah (hari)",
        desc: "Setelah berapa hari sejak close, periode otomatis di-lock (tidak bisa di-reopen tanpa approval).",
        impact: "Mencegah backdated journal di periode lama.",
        example: "7",
    },
    "period.allow_reopen": {
        label: "Izinkan Reopen",
        desc: "Apakah periode yang sudah ditutup boleh dibuka kembali oleh admin finance.",
        impact: "Bila false, koreksi harus via journal periode berjalan.",
        example: "true / false",
    },

    // ============ AUDIT ============
    "audit.retention_years": {
        label: "Retensi Audit (tahun)",
        desc: "Berapa tahun jurnal & dokumen GL disimpan untuk audit (UU PT: 10 tahun).",
        impact: "Memengaruhi kebijakan archival & purge.",
        example: "10",
    },
    "audit.archive_storage": {
        label: "Lokasi Archive",
        desc: "URI/path tempat arsip GL disimpan (S3 atau filesystem).",
        impact: "Path tujuan saat job archive lama berjalan.",
        example: '"s3://jbr-archive/gl"',
    },
    "audit.hash_chain_enabled": {
        label: "Hash-chain Audit",
        desc: "Aktifkan hash-chain pada journal_entries untuk tamper-evidence.",
        impact: "Setiap entry dirantai SHA256 — memperberat write tapi memberi proof of integrity.",
        example: "true / false",
    },

    // ============ GL / POSTING / SUBLEDGER ============
    "gl.dual_write_legacy": {
        label: "Dual-write ke Legacy",
        desc: "Tulis jurnal ke sistem GL legacy (selama transisi). Matikan setelah cutover penuh.",
        impact: "Bila true, ada overhead I/O tambahan tiap posting.",
        example: "true / false",
    },
    "gl.recon_alert_threshold_idr": {
        label: "Threshold Alert Rekonsiliasi",
        desc: "Selisih (IDR) antara legacy vs GL yang memicu alert recon.",
        impact: "Selisih di atas nilai ini akan masuk dashboard recon admin.",
        example: "1, 1000",
    },
    "posting.rounding_strategy": {
        label: "Strategi Pembulatan",
        desc: "HALF_EVEN (banker's rounding) atau HALF_UP untuk pembulatan PPN/PPh.",
        impact: "Memengaruhi 1-rupiah selisih pada agregasi besar.",
        example: '"HALF_EVEN", "HALF_UP"',
        allowedValues: ["HALF_EVEN", "HALF_UP"],
    },
    "posting.default_book": {
        label: "Buku Default",
        desc: "Book identifier default untuk posting (PLATFORM, MARKETPLACE, dst).",
        impact: "Posting tanpa book eksplisit akan ditujukan ke buku ini.",
        example: '"PLATFORM"',
    },
    "seller_subledger.enabled": {
        label: "Subledger Per-Seller",
        desc: "Aktifkan tracking saldo per-seller (utang ke seller, fee, payout).",
        impact: "Dipakai untuk laporan keuangan per-seller (B2B tier-2).",
        example: "true / false",
    },

    // ============ REPORT ============
    "report.balance_sheet_template": {
        label: "Template Neraca",
        desc: "Format Balance Sheet yang dipakai laporan.",
        impact: "Memengaruhi pengelompokan akun pada Neraca cetak.",
        example: '"PSAK1_CLASSIFIED", "PSAK1_LIQUIDITY"',
        allowedValues: ["PSAK1_CLASSIFIED", "PSAK1_LIQUIDITY"],
    },
    "report.profit_loss_classification": {
        label: "Klasifikasi P&L",
        desc: "Klasifikasi beban pada Profit & Loss.",
        impact: "BY_FUNCTION (HPP, Penjualan, Adm) vs BY_NATURE (Gaji, Sewa, Penyusutan).",
        example: '"BY_FUNCTION", "BY_NATURE"',
        allowedValues: ["BY_FUNCTION", "BY_NATURE"],
    },
    "report.cash_flow_method": {
        label: "Metode Cash Flow",
        desc: "Metode penyusunan laporan arus kas.",
        impact: "INDIRECT mulai dari net income; DIRECT memilah penerimaan/pengeluaran kas.",
        example: '"INDIRECT", "DIRECT"',
        allowedValues: ["INDIRECT", "DIRECT"],
    },

    // ============ NOTIFICATION ============
    "notification.finance_alert_emails": {
        label: "Email Alert Finance",
        desc: "Daftar email yang menerima alert finance (recon mismatch, period close due, dst).",
        impact: "Email ditambahkan akan menerima notifikasi pada event finance.",
        example: '["finance@jbr.com","cfo@jbr.com"]',
    },

    // ============ AFFILIATE ============
    "affiliate.commission_account_code": {
        label: "Akun Komisi Affiliate",
        desc: "Kode akun GL untuk biaya komisi affiliate (expense).",
        impact: "Posting komisi ke akun ini saat order disetujui.",
        example: '"66000"',
    },
    "affiliate.payable_account_code": {
        label: "Akun Utang Affiliate",
        desc: "Kode akun GL untuk utang ke affiliate (liability) sebelum payout.",
        impact: "Saldo utang affiliate ditampung di akun ini.",
        example: '"22200"',
    },
    "affiliate.default_rate_pct": {
        label: "Tarif Default Affiliate",
        desc: "Tarif komisi default (%) untuk affiliate baru.",
        impact: "Dipakai bila affiliate tidak punya rate khusus.",
        example: "2.0 (=2%)",
    },
    "affiliate.commission_base": {
        label: "Basis Komisi",
        desc: "Komisi dihitung dari subtotal kotor atau setelah dikurangi fee platform.",
        impact: "NET_OF_FEE menghasilkan komisi lebih kecil.",
        example: '"GROSS", "NET_OF_FEE"',
        allowedValues: ["GROSS", "NET_OF_FEE"],
    },
    "affiliate.withholding_kind": {
        label: "Jenis Withholding",
        desc: "Jenis pemotongan PPh atas komisi affiliate.",
        impact: "Menentukan tarif & laporan SPT yang relevan.",
        example: '"PPH_21", "PPH_23", "NONE"',
        allowedValues: ["PPH_21", "PPH_23", "NONE"],
    },
    "affiliate.withholding_rate": {
        label: "Tarif Withholding",
        desc: "Tarif pemotongan PPh atas komisi.",
        impact: "Komisi dipotong sebesar tarif ini sebelum payout.",
        example: "0.025 (=2.5%)",
    },
    "affiliate.attribution_window_days": {
        label: "Jendela Atribusi (hari)",
        desc: "Berapa hari setelah klik affiliate masih terhitung untuk konversi.",
        impact: "Window lebih panjang = lebih banyak konversi diakui.",
        example: "30, 60",
    },
    "affiliate.approval_delay_days": {
        label: "Delay Approval (hari)",
        desc: "Berapa hari setelah order delivered sebelum komisi disetujui.",
        impact: "Memberi waktu refund/cancel sebelum komisi final.",
        example: "7",
    },
    "affiliate.minimum_payout_idr": {
        label: "Minimum Payout (IDR)",
        desc: "Saldo minimum sebelum affiliate bisa request payout.",
        impact: "Mencegah payout receh; saldo di bawah threshold di-rolling.",
        example: "50000",
    },
    "affiliate.payout_schedule": {
        label: "Jadwal Payout",
        desc: "Frekuensi payout otomatis ke affiliate.",
        impact: "MONTHLY = sekali sebulan, WEEKLY = mingguan.",
        example: '"MONTHLY", "WEEKLY", "MANUAL"',
        allowedValues: ["MONTHLY", "WEEKLY", "MANUAL"],
    },
    "affiliate.clawback_policy": {
        label: "Kebijakan Clawback (Tarik-Balik Komisi)",
        allowedValues: ["OFFSET_NEXT", "INVOICE", "WRITE_OFF"],
        desc: 'Apa yang terjadi bila komisi affiliate sudah di-approve atau sudah dibayar, lalu ordernya di-refund atau dibatalkan pembeli. Ada 3 pilihan:\n• OFFSET_NEXT — Komisi yang harus ditarik kembali dipotong otomatis dari payout berikutnya. Paling simpel, tidak perlu invoice tambahan.\n• INVOICE — Platform menerbitkan tagihan (invoice) ke affiliate untuk melunasi komisi yang sudah terlanjur dibayar. Cocok bila affiliate sudah menarik dananya dan tidak ada saldo berikutnya.\n• WRITE_OFF — Komisi dihapuskan begitu saja (dianggap kerugian platform). Biasanya dipakai bila nilainya kecil dan tidak worth dikejar.',
        impact: "OFFSET_NEXT = potong dari payout berikutnya (rekomen default). INVOICE = tagih affiliate secara terpisah. WRITE_OFF = hapus beban, rugi ditanggung platform.",
        example: '"OFFSET_NEXT"  ← default yang disarankan\n"INVOICE"\n"WRITE_OFF"',
    },
    "affiliate.allow_self_referral": {
        label: "Izinkan Self-referral",
        desc: "Apakah affiliate boleh dapat komisi dari order sendiri.",
        impact: "Umumnya false untuk mencegah abuse.",
        example: "true / false",
    },

    // ============ CATALOG ============
    "catalog.sku_required_for_new_products": {
        label: "SKU Wajib",
        desc: "Produk baru harus memiliki SKU yang valid.",
        impact: "Bila true, seller tidak bisa menyimpan produk tanpa SKU.",
        example: "true / false",
    },
    "catalog.sku_format_regex": {
        label: "Format SKU (regex)",
        desc: "Pola regex yang harus dipatuhi setiap SKU.",
        impact: "SKU yang tidak match akan ditolak.",
        example: '"^[A-Z]{3}-[0-9]{4}$"',
    },
    "catalog.global_master_catalog_enabled": {
        label: "Master Catalog Global",
        desc: "Aktifkan katalog master lintas-seller (varian dipetakan ke produk master).",
        impact: "Memengaruhi search, merge listing, & analytics produk.",
        example: "true / false",
    },

    // ============ FIRSTPARTY (1P / inventory milik platform) ============
    "firstparty.enabled": {
        label: "Mode 1P Aktif",
        desc: "Aktifkan flow first-party (platform sebagai penjual + inventory).",
        impact: "Membuka modul COGS, inventory accounting, reorder.",
        example: "true / false",
    },
    "firstparty.cost_method": {
        label: "Metode Cost Inventory",
        desc: "Metode penilaian inventory: WEIGHTED_AVG, FIFO, atau STANDARD.",
        impact: "Memengaruhi nilai COGS & saldo inventory.",
        example: '"WEIGHTED_AVG", "FIFO", "STANDARD"',
        allowedValues: ["WEIGHTED_AVG", "FIFO", "STANDARD"],
    },
    "firstparty.default_revenue_account_code": {
        label: "Akun Revenue 1P",
        desc: "Kode akun GL untuk revenue penjualan 1P.",
        impact: "Posting revenue 1P diarahkan ke akun ini.",
        example: '"41600"',
    },
    "firstparty.default_cogs_account_code": {
        label: "Akun COGS 1P",
        desc: "Kode akun GL untuk Cost of Goods Sold 1P.",
        impact: "Posting COGS otomatis ke akun ini saat fulfillment.",
        example: '"51100"',
    },
    "firstparty.default_inventory_account_code": {
        label: "Akun Inventory 1P",
        desc: "Kode akun GL untuk persediaan/inventory 1P.",
        impact: "Saldo inventory dicatat di akun ini.",
        example: '"13100"',
    },
    "firstparty.allow_negative_stock": {
        label: "Izinkan Stok Negatif",
        desc: "Apakah penjualan boleh mengakibatkan stok negatif (oversell).",
        impact: "Bila false, posting penjualan ditolak ketika stok habis.",
        example: "true / false",
    },
    "firstparty.shrinkage_account_code": {
        label: "Akun Shrinkage",
        desc: "Akun untuk penyesuaian susut/hilang/rusak.",
        impact: "Selisih stok opname diposting ke akun ini.",
        example: '"51300"',
    },

    // ============ SELLER EXPORT ============
    "seller_export.signed_url_ttl_minutes": {
        label: "TTL Signed URL (menit)",
        desc: "Berapa menit URL download laporan seller berlaku.",
        impact: "Singkat = lebih aman; panjang = lebih nyaman.",
        example: "15",
    },
    "seller_export.file_retention_days": {
        label: "Retensi File Export",
        desc: "Berapa hari file export disimpan sebelum dihapus.",
        impact: "Setelah lewat batas, seller harus generate ulang.",
        example: "7, 30",
    },
    "seller_export.max_period_days": {
        label: "Maksimum Periode Export",
        desc: "Rentang hari maksimum yang boleh diminta dalam satu export.",
        impact: "Mencegah job berat (mis. >1 tahun).",
        example: "366",
    },
    "seller_export.max_concurrent_jobs_per_seller": {
        label: "Job Bersamaan / Seller",
        desc: "Jumlah job export bersamaan yang boleh berjalan per-seller.",
        impact: "Membatasi beban sistem dari satu seller.",
        example: "3",
    },
    "seller_export.pdf_signing_enabled": {
        label: "PDF Signing Aktif",
        desc: "Tandatangani PDF export dengan sertifikat digital.",
        impact: "Bila true, PDF lebih sulit dipalsukan tetapi proses lebih lambat.",
        example: "true / false",
    },
    "seller_export.verify_endpoint_enabled": {
        label: "Verify Endpoint Aktif",
        desc: "Aktifkan endpoint publik untuk verifikasi keaslian PDF (via hash).",
        impact: "Memungkinkan pihak ketiga (bank, auditor) memverifikasi.",
        example: "true / false",
    },

    // ============ SECURITY ============
    "security.rls_enabled": {
        label: "Row-Level Security",
        desc: "Aktifkan RLS PostgreSQL untuk data multi-tenant.",
        impact: "Bila true, query tanpa session context akan ditolak DB.",
        example: "true / false",
    },
    "security.leak_detector_cron": {
        label: "Cron Leak Detector",
        desc: "Jadwal cron untuk job deteksi data leak (cross-seller).",
        impact: "Frekuensi pengecekan otomatis.",
        example: '"0 2 * * *" (jam 2 pagi)',
    },
};

export function getSettingMeta(key: string): SettingMeta {
    return (
        settingMeta[key] ?? {
            label: key.split(".").slice(1).join(".") || key,
            desc: "Belum ada deskripsi untuk setting ini.",
            impact: "Hubungi tim finance untuk konfirmasi dampak perubahan.",
            example: "—",
        }
    );
}
