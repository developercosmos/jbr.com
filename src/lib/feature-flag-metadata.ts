/**
 * Friendly metadata layer untuk admin Feature Flags page.
 *
 * Setiap flag punya:
 *   - friendlyName: nama action-oriented dalam Bahasa Indonesia
 *   - description: penjelasan plain-language (untuk admin awam)
 *   - impact: list dampak yang spesifik (positif + risiko)
 *   - risk: low | medium | high
 *   - icon: emoji untuk quick scanning
 *   - ticket: nomor tiket plan (untuk traceability)
 *   - dependencies: flag lain yang sebaiknya hidup duluan
 *
 * Tujuan: admin non-teknis bisa kelola rollout tanpa perlu baca kode.
 */

export type FlagRisk = "low" | "medium" | "high";

export interface FeatureFlagMetadata {
    friendlyName: string;
    description: string;
    impact: { positive: string[]; risk: string[] };
    risk: FlagRisk;
    icon: string;
    ticket: string;
    dependencies?: string[];
    /** "Bagian mana dari aplikasi yang terdampak" — surface lokasi UX. */
    affectedSurface: string;
}

export const FEATURE_FLAG_META: Record<string, FeatureFlagMetadata> = {
    // ─── Halaman Produk (PDP) ─────────────────────────────────────────────
    "pdp.inline_offer": {
        friendlyName: "Tawar Langsung di Halaman Produk",
        description:
            "Pembeli bisa mengetik harga tawaran langsung di sidebar halaman produk, tanpa harus membuka popup atau modal terpisah.",
        impact: {
            positive: [
                "Mempercepat proses tawar-menawar — pembeli tidak perlu klik dua kali.",
                "Estimasi conversion rate ke tawaran naik 15–20%.",
            ],
            risk: [
                "Bisa memicu tawaran spam jika 'Batas Tawaran Per Pembeli' (parent flag) belum aktif.",
            ],
        },
        risk: "medium",
        icon: "💸",
        ticket: "PDP-02",
        dependencies: ["pdp.offer_rate_limit"],
        affectedSurface: "Halaman Produk › Sidebar tawar",
    },
    "pdp.offer_rate_limit": {
        friendlyName: "Batas Tawaran Per Pembeli",
        description:
            "Membatasi jumlah tawaran yang bisa dikirim seorang pembeli ke produk yang sama: maksimum 3 tawaran per 24 jam, dengan jeda makin lama setelah ditolak.",
        impact: {
            positive: [
                "Mencegah spam tawaran ke seller.",
                "Mengurangi notifikasi noise di inbox seller.",
            ],
            risk: [
                "Pembeli serius mungkin terblokir kalau salah klik berulang. Jeda awal 2 jam.",
            ],
        },
        risk: "low",
        icon: "🛡️",
        ticket: "PDP-02b",
        affectedSurface: "Backend offers — invisible ke user, tapi efek terasa saat tawar berulang",
    },
    "pdp.seller_badges": {
        friendlyName: "Lencana Kepercayaan Seller",
        description:
            "Tampilkan lencana di kartu seller seperti Verified, Top Rated, Very Responsive, Reliable Shipper, Trusted Veteran berdasarkan data reputasi seller.",
        impact: {
            positive: [
                "Meningkatkan trust pembeli, menurunkan bounce rate halaman produk.",
                "Seller bagus mendapat pengakuan visual, mendorong kompetisi sehat.",
            ],
            risk: [
                "Seller baru tanpa lencana mungkin merasa 'kalah saing' visual.",
            ],
        },
        risk: "low",
        icon: "🏅",
        ticket: "PDP-03",
        affectedSurface: "Halaman Produk › Kartu seller",
    },
    "pdp.seller_join_date": {
        friendlyName: "Tampilkan Tanggal Gabung Seller",
        description:
            "Menampilkan label 'Bergabung X bulan/tahun lalu' di kartu seller, untuk transparansi riwayat. Otomatis disembunyikan bila seller belum punya listing aktif.",
        impact: {
            positive: [
                "Buyer bisa menilai seberapa berpengalaman seller.",
                "Seller veteran mendapat kredibilitas tambahan.",
            ],
            risk: [
                "Seller baru bisa terlihat kurang meyakinkan. Counter-balance: digabung dengan lencana lain.",
            ],
        },
        risk: "low",
        icon: "📅",
        ticket: "PDP-04",
        affectedSurface: "Halaman Produk › Kartu seller",
    },
    "pdp.review_thumbnail": {
        friendlyName: "Thumbnail Produk di Ulasan",
        description:
            "Menampilkan gambar mini produk yang diulas pada setiap kartu ulasan, supaya pembeli yakin ulasan tersebut relevan ke produk yang sedang dilihat.",
        impact: {
            positive: [
                "Meningkatkan kredibilitas ulasan.",
                "Pembeli lebih percaya rating bintang yang dilihat.",
            ],
            risk: [
                "Halaman produk dengan banyak ulasan akan request banyak gambar — sudah dimitigasi via lazy load + variant thumbnail 160px.",
            ],
        },
        risk: "low",
        icon: "🖼️",
        ticket: "PDP-05",
        affectedSurface: "Halaman Produk › Section ulasan",
    },
    "pdp.buyer_rating": {
        friendlyName: "Seller Bisa Menilai Pembeli",
        description:
            "Memberi seller mekanisme formal untuk memberi rating dan tag perilaku ke pembeli/calon pembeli setelah transaksi atau chat berakhir. Tag termasuk: penawaran ekstrim, ghosting, komunikasi tidak sopan, kooperatif.",
        impact: {
            positive: [
                "Mengurangi spam tawaran ekstrim dari pembeli low-quality.",
                "Insentif buyer untuk berperilaku baik (membangun reputasi).",
                "Foundation untuk skor reputasi pembeli (PDP-09).",
            ],
            risk: [
                "Berpotensi disalahgunakan seller untuk balas dendam → wajib gabung dengan dispute workflow (PDP-10).",
                "Pembeli bisa merasa diintimidasi.",
            ],
        },
        risk: "high",
        icon: "⭐",
        ticket: "PDP-08",
        dependencies: ["pdp.dispute_rating"],
        affectedSurface: "Inbox seller, halaman order, halaman messages",
    },
    "pdp.buyer_reputation": {
        friendlyName: "Skor Reputasi Pembeli",
        description:
            "Hitung skor reputasi pembeli (0–100) dari rating yang seller berikan, lalu tampilkan ke seller sebagai band Low/Medium/High Risk — dengan privacy guard: seller hanya melihat band setelah ada interaksi nyata dengan pembeli tersebut.",
        impact: {
            positive: [
                "Seller dapat sinyal awal kualitas pembeli sebelum negosiasi.",
                "Pembeli high-trust bisa dapat akses ke 'tier floor price' yang lebih bagus.",
            ],
            risk: [
                "Privacy: jika visibility resolver bocor, seller bisa scrape reputasi pembeli — mitigasi: rate limit 60/menit + audit log per akses.",
            ],
        },
        risk: "high",
        icon: "🎯",
        ticket: "PDP-09",
        dependencies: ["pdp.buyer_rating"],
        affectedSurface: "Inbox seller, halaman chat, panel offer",
    },
    "pdp.dispute_rating": {
        friendlyName: "Sengketa Rating Pembeli",
        description:
            "Pembeli dapat menggugat rating yang seller berikan kepadanya. Admin trust review dan bisa membatalkan rating yang invalid → skor reputasi pembeli otomatis dihitung ulang.",
        impact: {
            positive: [
                "Mekanisme appeal yang fair untuk pembeli.",
                "Mencegah seller abuse rating untuk balas dendam.",
            ],
            risk: [
                "Volume dispute bisa membanjiri queue trust admin — mitigasi: rate limit 5 dispute/hari per buyer + outlier detection seller.",
            ],
        },
        risk: "high",
        icon: "⚖️",
        ticket: "PDP-10",
        dependencies: ["pdp.buyer_rating"],
        affectedSurface: "Halaman messages buyer, /admin/disputes",
    },

    // ─── Fitur Unggulan (Differentiator) ──────────────────────────────────
    "dif.smart_offer_guardrail": {
        friendlyName: "Saran Tawaran Cerdas",
        description:
            "Saat pembeli mengetik tawaran, sistem memberi feedback realtime: 'Tawaran terlalu rendah, kemungkinan ditolak 80%' berdasarkan histori kategori produk.",
        impact: {
            positive: [
                "Pembeli menawar lebih realistis, mengurangi noise tawaran ekstrim.",
                "Seller mendapat tawaran yang lebih masuk akal — closing rate naik.",
            ],
            risk: [
                "Pembeli ekstrim mungkin terdorong tetap submit setelah peringatan.",
            ],
        },
        risk: "low",
        icon: "🎲",
        ticket: "DIF-01",
        affectedSurface: "Halaman Produk › Sidebar tawar",
    },
    "dif.seller_reliability_score": {
        friendlyName: "Skor Reliabilitas Seller",
        description:
            "Skor gabungan 0–100 dari rating, response time, completion rate, cancellation rate, dispute rate. Ditampilkan sebagai tier Bronze/Silver/Gold/Platinum di kartu seller.",
        impact: {
            positive: [
                "Trust signal lebih objektif daripada bintang saja.",
                "Seller termotivasi memperbaiki SLA, bukan hanya rating bintang.",
            ],
            risk: [
                "Seller baru susah naik tier. Counter: tier Bronze tetap layak ditampilkan.",
            ],
        },
        risk: "low",
        icon: "🏆",
        ticket: "DIF-02",
        affectedSurface: "Kartu seller di PDP, /store/[slug], inbox checkout",
    },
    "dif.offer_sla": {
        friendlyName: "Auto Reminder Tawaran",
        description:
            "Sistem otomatis mengingatkan seller setelah 24 jam tawaran masuk, mengingatkan pembeli setelah 48 jam belum direspons, dan auto-expire setelah 72 jam dengan saran produk alternatif ke pembeli.",
        impact: {
            positive: [
                "Mengurangi 'dead-end' negosiasi.",
                "Pembeli tidak menunggu tanpa kepastian.",
            ],
            risk: [
                "Volume notifikasi naik. Dimitigasi via idempotency key (1 reminder per stage).",
            ],
        },
        risk: "low",
        icon: "⏰",
        ticket: "DIF-03",
        affectedSurface: "Backend cron + notifikasi email/in-app",
    },
    "dif.condition_checklist": {
        friendlyName: "Checklist Kondisi Barang Bekas",
        description:
            "Form wajib untuk seller produk preloved: integritas frame, kondisi grip, tegangan senar, paint chips. Strukturnya konsisten supaya pembeli mudah compare.",
        impact: {
            positive: [
                "Mengurangi mismatch ekspektasi pembeli (klaim 'mulus' bisa diuji checklist).",
                "Dispute pasca-beli turun.",
            ],
            risk: [
                "Friction tambahan untuk seller saat upload listing — dimitigasi: hanya wajib kategori PRELOVED.",
            ],
        },
        risk: "low",
        icon: "📋",
        ticket: "DIF-04",
        affectedSurface: "/seller/products/add, /seller/products/[id]/edit",
    },
    "dif.compare_mode": {
        friendlyName: "Mode Bandingkan Produk",
        description:
            "Pembeli bisa pin 1–3 produk lalu lihat side-by-side specs (weight, balance, shaft flex, harga) di halaman /compare.",
        impact: {
            positive: [
                "Retensi naik (user tidak harus tab-switch).",
                "Keputusan beli lebih cepat.",
            ],
            risk: [
                "Pembeli yang ragu bisa decision-paralysis. Dimitigasi: max 3 pin.",
            ],
        },
        risk: "low",
        icon: "🔀",
        ticket: "DIF-05",
        affectedSurface: "/compare, tombol compare di kartu produk",
    },
    "dif.negotiation_insights": {
        friendlyName: "Insights Negosiasi Seller",
        description:
            "Dashboard untuk seller: heatmap jam terbaik menerima tawaran, distribusi diskon yang biasa diterima per produk, saran floor price.",
        impact: {
            positive: [
                "Seller jadi data-driven, conversion naik.",
                "Membantu seller menetapkan harga floor yang masuk akal.",
            ],
            risk: [
                "Seller naive bisa over-aggressively cap floor → pembeli kabur.",
            ],
        },
        risk: "low",
        icon: "📊",
        ticket: "DIF-06",
        affectedSurface: "/seller/analytics",
    },
    "dif.two_way_reputation_surface": {
        friendlyName: "Surface UI Reputasi Dua Arah",
        description:
            "Polish visual: badge risk pembeli muncul di view chat seller, indikator ringkas pre-offer.",
        impact: {
            positive: [
                "Seller dapat sinyal di tempat keputusan dibuat (chat & inbox), bukan di halaman terpisah.",
            ],
            risk: [
                "Bergantung pada PDP-08 + PDP-09 — kalau parent disabled, fitur ini efektif mati.",
            ],
        },
        risk: "medium",
        icon: "🔁",
        ticket: "DIF-07",
        dependencies: ["pdp.buyer_rating"],
        affectedSurface: "Inbox chat seller, panel offer",
    },
    "dif.live_presence": {
        friendlyName: "Indikator Pengunjung Live di Produk",
        description:
            "Chip kecil di halaman produk yang menampilkan '3 sedang melihat' atau '1 sedang menawar' — count saja, tidak pernah identitas. Privacy floor: tidak tampil kalau cuma 1 pengunjung.",
        impact: {
            positive: [
                "Urgency psikologis — mendorong keputusan beli lebih cepat.",
                "Differentiator unik (Carousell tidak punya ini di pasar Indonesia).",
            ],
            risk: [
                "Bisa dipersepsikan 'fake urgency' kalau jumlah selalu 0. Default OFF aman.",
            ],
        },
        risk: "low",
        icon: "👀",
        ticket: "DIF-08",
        affectedSurface: "Halaman Produk › Sidebar atas",
    },
    "dif.auto_counter": {
        friendlyName: "Counter Tawaran Otomatis",
        description:
            "Saat pembeli menawar di bawah floor price seller, sistem otomatis kirim counter di tengah-tengah (offer + floor) / 2, label 'JBR menyarankan harga ini'. Maks 1 auto-counter per thread.",
        impact: {
            positive: [
                "Mengurangi tawaran rejected (auto-negotiate alih-alih reject).",
                "Mempercepat closing time.",
            ],
            risk: [
                "Seller mungkin merasa kehilangan kontrol — dimitigasi: seller tetap bisa override.",
            ],
        },
        risk: "medium",
        icon: "🤖",
        ticket: "DIF-09",
        affectedSurface: "Halaman Produk + chat",
    },
    "dif.trust_insurance": {
        friendlyName: "Bayar Aman+ (Buyer Protection Tier)",
        description:
            "Biaya buyer protection tergantung reliabilitas seller: skor < 70 kena 1%, 70–89 kena 0,5%, ≥ 90 gratis. Insentif: seller berkualitas dapat akses ke 0% fee.",
        impact: {
            positive: [
                "Pembeli dapat asuransi otomatis terintegrasi escrow.",
                "Insentif kuat bagi seller untuk menjaga skor reliabilitas.",
            ],
            risk: [
                "Total checkout jadi sedikit lebih tinggi untuk seller risk tinggi → pembeli mungkin pilih kompetitor.",
            ],
        },
        risk: "medium",
        icon: "🛡️",
        ticket: "DIF-10",
        affectedSurface: "Halaman checkout",
    },
    "dif.audit_replay": {
        friendlyName: "Riwayat Interaksi (Audit Replay)",
        description:
            "Halaman timeline kronologis: chat + tawaran + view PDP + dispute, terurut waktu. Untuk pembeli/seller di /order/[id]/timeline dan untuk admin di /admin/disputes/[id]/timeline. Chat sudah disensor (nomor, email, link di-mask).",
        impact: {
            positive: [
                "Reduce dispute resolution time 50%+ — semua bukti dalam 1 halaman.",
                "Transparansi: pembeli/seller bisa lihat sendiri urutan kejadian.",
            ],
            risk: [
                "Membuka thread chat di context dispute — sudah dimitigasi via PII sanitize.",
            ],
        },
        risk: "low",
        icon: "📜",
        ticket: "DIF-11",
        affectedSurface: "/order/[id]/timeline, /admin/disputes/[id]/timeline",
    },
    "dif.smart_questions": {
        friendlyName: "Pertanyaan Cepat di Chat",
        description:
            "Saat pembeli buka chat ke seller dari halaman produk, muncul 3 chip pertanyaan siap-pakai berdasarkan kategori (mis. raket: 'berat aktual?', 'tegangan senar?'). Klik chip = langsung kirim.",
        impact: {
            positive: [
                "First-message rate naik 30% (dari blank chat box).",
                "Pertanyaan berkualitas → seller respon lebih cepat.",
            ],
            risk: [
                "Pertanyaan terlalu generik bisa dianggap mengganggu. Default 3 chip saja, hilang setelah 1 kali pakai.",
            ],
        },
        risk: "low",
        icon: "💬",
        ticket: "DIF-12",
        affectedSurface: "/chat — atas input box, hanya saat buyer belum kirim pesan",
    },
    "dif.intent_score": {
        friendlyName: "Skor Niat Pembeli",
        description:
            "Hitung skor 0–100 dari time-on-page + scroll depth saat pembeli submit tawaran. Tawaran dengan skor < 30 ditandai 'Quick offer' di inbox seller, sehingga seller bisa prioritaskan tawaran berkualitas.",
        impact: {
            positive: [
                "Seller bisa filter spam offer dari pembeli low-intent.",
                "Default sort inbox: high intent dulu.",
            ],
            risk: [
                "Pembeli kembali ke halaman yang pernah dilihat = skor tinggi (false positive). Dimitigasi: ini sinyal, bukan blok.",
            ],
        },
        risk: "low",
        icon: "🎯",
        ticket: "DIF-13",
        affectedSurface: "Inbox tawaran seller (label 'Quick offer'), tidak terlihat ke pembeli",
    },
    "dif.tier_floor_price": {
        friendlyName: "Harga Floor Tier (Reward Pembeli Trusted)",
        description:
            "Seller bisa set 3 floor price: default, high-trust, platinum. Pembeli dengan skor reputasi tinggi otomatis dapat akses ke floor lebih rendah — invisible (tidak diberitahu eksplisit).",
        impact: {
            positive: [
                "Reward loyal/trusted buyer dengan akses ke harga member.",
                "Mendorong pembeli membangun reputasi baik.",
            ],
            risk: [
                "Kalau bocor ke pembeli biasa = persepsi unfair. Dimitigasi: server-side resolution only, audit log.",
            ],
        },
        risk: "high",
        icon: "💎",
        ticket: "DIF-14",
        dependencies: ["pdp.buyer_reputation"],
        affectedSurface: "Backend offers — invisible ke pembeli",
    },
    "dif.match_score": {
        friendlyName: "Skor Kecocokan Produk",
        description:
            "Ring meter 0–100 di kartu produk yang menunjukkan seberapa cocok produk dengan profil pembeli (style bermain, skill level, budget). Berdasarkan implicit feedback dari klik & impression.",
        impact: {
            positive: [
                "Personalisasi tingkat lanjut.",
                "Click-through rate naik — pembeli klik produk yang relevan.",
            ],
            risk: [
                "Cold start untuk user baru (tanpa histori). Fallback ke popularity score.",
            ],
        },
        risk: "low",
        icon: "🎯",
        ticket: "DIF-15",
        affectedSurface: "Kartu produk di home, search, kategori",
    },
};

export function getFlagMeta(key: string): FeatureFlagMetadata | null {
    return FEATURE_FLAG_META[key] ?? null;
}

// ─── Glossary istilah ────────────────────────────────────────────────────
export interface GlossaryEntry {
    term: string;
    short: string;
    long: string;
}

export const GLOSSARY: GlossaryEntry[] = [
    {
        term: "Feature Flag",
        short: "Saklar fitur yang bisa di-on/off tanpa redeploy server.",
        long:
            "Setiap fitur baru di JBR dilindungi flag. Default OFF. Admin bisa enable kapan saja, ke siapa saja (audience), seberapa banyak (rollout %), atau matikan instan saat ada masalah (kill switch).",
    },
    {
        term: "Rollout %",
        short: "Persentase pengguna yang melihat fitur saat enabled.",
        long:
            "Misal 10% berarti hanya 10 dari 100 user melihat fitur. Berdasarkan hash userId — user yang sama selalu masuk bucket yang sama (deterministik). Naikkan bertahap: 10 → 50 → 100 sambil monitor metrik.",
    },
    {
        term: "Audience",
        short: "Whitelist user yang ALWAYS dapat fitur, tanpa peduli rollout %.",
        long:
            "Tiga jenis: roles (mis. ADMIN), userIds (whitelist email/id spesifik), cohorts (kelompok beta). Audience SELALU menang dari rollout %. Cocok untuk dogfood internal sebelum public rollout.",
    },
    {
        term: "Variants A/B/C",
        short: "Bagi user ke beberapa versi fitur untuk eksperimen.",
        long:
            "Format: name=weight. Mis. control=50, variant_a=50 → 50% lihat versi lama, 50% lihat versi baru. Total bobot ≤ 100. Hash deterministik per user.",
    },
    {
        term: "Kill Switch",
        short: "Tombol emergency mematikan banyak flag sekaligus.",
        long:
            "Saat incident: aktivasi dengan ketik 'MATIKAN SEMUA' + alasan. Scope: all-new (semua fitur baru), pdp-only (hanya halaman produk), differentiator-only (hanya fitur unggulan). Instan < 30 detik propagation.",
    },
    {
        term: "Parent Flag",
        short: "Flag yang harus aktif dulu sebelum child boleh aktif.",
        long:
            "Mis. 'Tawar Langsung' (pdp.inline_offer) punya parent 'Batas Tawaran Per Pembeli' (pdp.offer_rate_limit). Kalau parent OFF, child otomatis OFF — mencegah deploy fitur tanpa proteksi spam.",
    },
    {
        term: "Kategori Trust",
        short: "Flag yang menyentuh dispute, rating, atau privacy data buyer.",
        long:
            "Toggle wajib ketik 'SAYA YAKIN' sebagai konfirmasi (semacam soft 2FA). Audit log menyimpan konfirmasi phrase. Risiko tinggi → hati-hati.",
    },
    {
        term: "Audit Log",
        short: "Histori semua perubahan flag untuk traceability.",
        long:
            "Siapa, kapan, sebelum/sesudah, alasan, IP, user-agent. Retention 2 tahun. Dipakai untuk dispute defense + compliance audit.",
    },
    {
        term: "Scheduled Toggle",
        short: "Auto enable/disable di waktu yang ditentukan.",
        long:
            "Set 'Scheduled Enable' = tanggal+jam → cron tiap menit akan auto-aktivasi pada waktu itu. Cocok untuk peluncuran terjadwal (mis. promo Lebaran).",
    },
    {
        term: "Risk Level",
        short: "Indikator tingkat risiko aktivasi flag.",
        long:
            "Rendah = bisa langsung 100%. Sedang = naikkan 10→50→100 dengan monitor. Tinggi = dogfood internal dulu, ada parent/dependency yang harus aktif duluan.",
    },
];
