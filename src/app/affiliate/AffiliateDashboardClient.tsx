"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    Copy,
    Check,
    Banknote,
    Upload,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Building2,
} from "lucide-react";
import { enrollAffiliate } from "@/actions/affiliate";

interface DashboardData {
    account: {
        code: string;
        status: string;
        reviewNotes: string | null;
        reviewedAt: string | null;
        payoutMethod: string | null;
        payoutAccount: string | null;
        fullName: string | null;
        nik: string | null;
        phone: string | null;
        instagramHandle: string | null;
        ktpUrl: string | null;
        statementUrl: string | null;
        bankName: string | null;
        bankAccountNumber: string | null;
        bankAccountName: string | null;
    } | null;
    prefill: {
        name: string | null;
        phone: string | null;
        kycStatus: string | null;
        kycHasKtp: boolean;
        suggestedCode: string;
    };
    totals: { clicks: number; conversions: number; pending: number; cleared: number; reversed: number };
    attributions: Array<{
        id: string;
        orderId: string;
        commission: number;
        rate: number;
        status: string;
        createdAt: string;
    }>;
}

interface Props {
    initial: DashboardData;
    baseUrl: string;
}

interface BankModal {
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
}

export default function AffiliateDashboardClient({ initial, baseUrl }: Props) {
    const router = useRouter();
    const [data] = useState(initial);
    const { prefill } = data;
    const account = data.account;
    const isRejected = account?.status === "REJECTED";
    const canEditApplication = !account || isRejected;

    // ── enrollment form state ──────────────────────────────────────────────
    const [fullName, setFullName] = useState(account?.fullName ?? prefill.name ?? "");
    const [nik, setNik] = useState(account?.nik ?? "");
    const [phone, setPhone] = useState(
        (account?.phone ?? prefill.phone) ? (account?.phone ?? prefill.phone ?? "").replace(/^\+62/, "").replace(/^0/, "") : ""
    );
    const [instagram, setInstagram] = useState(account?.instagramHandle ?? "");
    const [referralCode, setReferralCode] = useState(account?.code ?? prefill.suggestedCode);
    const [ktpUrl, setKtpUrl] = useState(account?.ktpUrl ?? "");
    const [statementUrl, setStatementUrl] = useState(account?.statementUrl ?? "");
    const [bankModal, setBankModal] = useState<BankModal>({
        bankName: account?.bankName ?? "",
        bankAccountNumber: account?.bankAccountNumber ?? "",
        bankAccountName: account?.bankAccountName ?? "",
    });
    const [bankSaved, setBankSaved] = useState(
        Boolean(account?.bankName && account?.bankAccountNumber && account?.bankAccountName)
    );
    const [showBankModal, setShowBankModal] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const [isUploadingKtp, setIsUploadingKtp] = useState(false);
    const [isUploadingStatement, setIsUploadingStatement] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    const ktpInputRef = useRef<HTMLInputElement>(null);
    const stmtInputRef = useRef<HTMLInputElement>(null);

    // ── KYC pre-fill banner ────────────────────────────────────────────────
    const kycVerified = prefill.kycStatus === "APPROVED";

    // ── upload helper ──────────────────────────────────────────────────────
    const handleFileUpload = useCallback(
        async (
            file: File,
            folder: string,
            setUrl: (u: string) => void,
            setLoading: (v: boolean) => void,
            setPreFillFields?: (url: string) => void
        ) => {
            setLoading(true);
            try {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("folder", folder);
                const res = await fetch("/api/upload", { method: "POST", body: fd });
                const json = await res.json();
                if (!res.ok || json.error) throw new Error(json.error || "Upload gagal");
                setUrl(json.payload?.url ?? json.url ?? "");
                setPreFillFields?.(json.payload?.url ?? json.url ?? "");
            } catch (e) {
                setError(e instanceof Error ? e.message : "Upload gagal");
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // ── referral code helpers ──────────────────────────────────────────────
    function refreshCode() {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        const base = (fullName || "aff")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 6);
        const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        setReferralCode(`${base || "aff"}${suffix}`);
    }

    // ── validation ─────────────────────────────────────────────────────────
    function validate() {
        const errs: Record<string, string> = {};
        if (!ktpUrl) errs.ktp = "Foto KTP wajib diupload";
        if (!fullName.trim()) errs.fullName = "Nama lengkap wajib diisi";
        if (!nik.trim()) errs.nik = "Nomor KTP wajib diisi";
        if (!phone.trim()) errs.phone = "Nomor handphone wajib diisi";
        if (!referralCode || referralCode.length < 5) errs.referralCode = "Minimal 5 karakter";
        if (!/^[a-z0-9]+$/i.test(referralCode)) errs.referralCode = "Hanya huruf dan angka";
        if (!bankSaved) errs.bank = "Detail rekening bank wajib diisi";
        if (!agreed) errs.agreed = "Anda harus menyetujui syarat & ketentuan";
        return errs;
    }

    function handleEnroll() {
        setError(null);
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            return;
        }
        setFieldErrors({});
        startTransition(async () => {
            try {
                await enrollAffiliate({
                    fullName: fullName.trim(),
                    nik: nik.trim(),
                    phone: `+62${phone.trim()}`,
                    instagramHandle: instagram.trim() || undefined,
                    ktpUrl,
                    statementUrl: statementUrl || undefined,
                    bankName: bankModal.bankName,
                    bankAccountNumber: bankModal.bankAccountNumber,
                    bankAccountName: bankModal.bankAccountName,
                    payoutMethod: bankModal.bankName,
                    payoutAccount: bankModal.bankAccountNumber,
                    referralCode: referralCode.toLowerCase(),
                });
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mendaftar afiliasi.");
            }
        });
    }

    function handleCopy(link: string) {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // Registration form (not yet enrolled)
    // ══════════════════════════════════════════════════════════════════════
    if (canEditApplication) {
        return (
            <>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {isRejected ? "Ajukan Ulang Affiliate" : "Daftar sebagai Affiliate"}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {isRejected
                                ? "Perbarui data affiliate Anda sesuai catatan review admin, lalu kirim ulang untuk ditinjau kembali."
                                : "Isi data diri Anda untuk mendaftarkan akun afiliasi. Setelah terdaftar Anda akan mendapat link unik dan komisi dari setiap pesanan via link Anda. Self-purchase tidak dihitung."}
                        </p>
                    </div>

                    {isRejected && account?.reviewNotes && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium">Pengajuan affiliate sebelumnya ditolak</div>
                                <div>{account.reviewNotes}</div>
                            </div>
                        </div>
                    )}

                    {/* KYC status banner */}
                    {kycVerified && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            KYC Anda sudah terverifikasi. Data KTP dapat diisi langsung.
                        </div>
                    )}
                    {prefill.kycStatus && !kycVerified && prefill.kycHasKtp && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            KYC Anda sedang dalam proses review. Silakan upload KTP dan isi data di bawah ini.
                        </div>
                    )}

                    {/* Upload KTP */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Upload Foto KTP <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                ref={ktpInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    handleFileUpload(f, "ktp", setKtpUrl, setIsUploadingKtp);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => ktpInputRef.current?.click()}
                                disabled={isUploadingKtp}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-black/20 hover:bg-slate-50 disabled:opacity-60"
                            >
                                {isUploadingKtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {ktpUrl ? "Ganti File" : "Choose File"}
                            </button>
                            <span className="text-sm text-slate-500">{ktpUrl ? "✓ KTP terupload" : "No file chosen"}</span>
                        </div>
                        <p className="mt-1 text-xs text-brand-primary">Upload foto KTP untuk ekstraksi NIK dan nama otomatis (wajib)</p>
                        {fieldErrors.ktp && <p className="mt-1 text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{fieldErrors.ktp}</p>}
                    </div>

                    {/* Nama Lengkap */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nama Lengkap <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder={ktpUrl ? "Isi nama sesuai KTP" : "Akan diisi otomatis setelah upload KTP"}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                        />
                        {!ktpUrl && (
                            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Upload foto KTP terlebih dahulu
                            </p>
                        )}
                        {fieldErrors.fullName && <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>}
                    </div>

                    {/* NIK */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Nomor KTP <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={16}
                            placeholder={ktpUrl ? "Masukkan 16 digit NIK" : "Akan diisi otomatis setelah upload KTP"}
                            value={nik}
                            onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                        />
                        {!ktpUrl && (
                            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Upload foto KTP terlebih dahulu
                            </p>
                        )}
                        {fieldErrors.nik && <p className="mt-1 text-xs text-rose-600">{fieldErrors.nik}</p>}
                    </div>

                    {/* Instagram */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Instagram
                        </label>
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-black/20">
                            <span className="px-3 py-2 text-sm text-slate-500 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black/30">@</span>
                            <input
                                type="text"
                                placeholder="nama_pengguna_anda"
                                value={instagram}
                                onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                                className="flex-1 px-3 py-2 bg-transparent text-sm outline-none"
                            />
                        </div>
                    </div>

                    {/* No. Handphone */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            No. Handphone <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-black/20">
                            <span className="flex items-center gap-1 px-3 py-2 text-sm text-slate-700 border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-black/30">
                                <span className="w-4 h-3 rounded-sm overflow-hidden inline-block" style={{background: "linear-gradient(to bottom, #e70011 50%, #fff 50%)"}}>
                                    {/* simplified flag */}
                                </span>
                                +62
                            </span>
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="Masukkan nomor telepon Anda"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                className="flex-1 px-3 py-2 bg-transparent text-sm outline-none"
                            />
                        </div>
                        {fieldErrors.phone && <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p>}
                    </div>

                    {/* Referral Code */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Referral Code <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Kode referral unik Anda"
                                value={referralCode}
                                onChange={(e) => setReferralCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                                maxLength={20}
                                className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm font-mono"
                            />
                            <button
                                type="button"
                                onClick={refreshCode}
                                title="Generate ulang kode"
                                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50"
                            >
                                <RefreshCw className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Kode referral <span className="font-medium text-brand-primary">unik</span> Anda untuk melacak komisi. Minimal 5 karakter, hanya huruf dan angka yang diperbolehkan.</p>
                        {fieldErrors.referralCode && <p className="mt-1 text-xs text-rose-600">{fieldErrors.referralCode}</p>}
                    </div>

                    {/* Detail Rekening Bank */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Detail Rekening Bank <span className="text-rose-500">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowBankModal(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm text-left hover:bg-slate-100"
                        >
                            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            {bankSaved ? (
                                <span className="text-slate-700 dark:text-slate-300">
                                    {bankModal.bankName} — {bankModal.bankAccountNumber} a/n {bankModal.bankAccountName}
                                </span>
                            ) : (
                                <span className="text-slate-400">Klik untuk mengisi detail rekening bank</span>
                            )}
                        </button>
                        {fieldErrors.bank && <p className="mt-1 text-xs text-rose-600">{fieldErrors.bank}</p>}
                    </div>

                    {/* Surat Pernyataan */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Surat Pernyataan{" "}
                            <span className="text-slate-400 font-normal">(Optional)</span>{" "}
                            <a
                                href="/docs/surat-pernyataan-afiliasi.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-primary text-xs underline"
                            >
                                Download di sini ↗
                            </a>
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                ref={stmtInputRef}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    handleFileUpload(f, "statements", setStatementUrl, setIsUploadingStatement);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => stmtInputRef.current?.click()}
                                disabled={isUploadingStatement}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-black/20 hover:bg-slate-50 disabled:opacity-60"
                            >
                                {isUploadingStatement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {statementUrl ? "Ganti File" : "Choose File"}
                            </button>
                            <span className="text-sm text-slate-500">{statementUrl ? "✓ Surat terupload" : "No file chosen"}</span>
                        </div>
                        <p className="mt-1 text-xs text-brand-primary">
                            Upload surat pernyataan jika nama pendaftar affiliate berbeda dengan nama asli di KTP / NPWP / Nama Pemilik Rekening Bank.
                        </p>
                    </div>

                    {/* Agreement */}
                    <div className="flex items-start gap-2">
                        <input
                            id="agree"
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-0.5 accent-brand-primary"
                        />
                        <label htmlFor="agree" className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
                            Saya setuju dengan{" "}
                            <a href="/terms/affiliate" className="text-brand-primary underline" target="_blank" rel="noopener noreferrer">
                                Syarat &amp; Ketentuan Program Afiliasi
                            </a>{" "}
                            dan{" "}
                            <a href="/privacy" className="text-brand-primary underline" target="_blank" rel="noopener noreferrer">
                                Kebijakan Privasi
                            </a>
                        </label>
                    </div>
                    {fieldErrors.agreed && <p className="text-xs text-rose-600">{fieldErrors.agreed}</p>}

                    {error && <p className="text-xs text-rose-600">{error}</p>}

                    <button
                        type="button"
                        onClick={handleEnroll}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isRejected ? "Ajukan Ulang Affiliate" : "Buat Akun Afiliasi"}
                    </button>
                </div>

                {/* Bank modal */}
                {showBankModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                            <h3 className="font-bold text-lg">Detail Rekening Bank</h3>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Bank</label>
                                <input
                                    type="text"
                                    placeholder="BCA / Mandiri / BRI / BNI / dll"
                                    value={bankModal.bankName}
                                    onChange={(e) => setBankModal((p) => ({ ...p, bankName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nomor Rekening</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Nomor rekening"
                                    value={bankModal.bankAccountNumber}
                                    onChange={(e) => setBankModal((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Pemilik Rekening</label>
                                <input
                                    type="text"
                                    placeholder="Sesuai buku tabungan / KTP"
                                    value={bankModal.bankAccountName}
                                    onChange={(e) => setBankModal((p) => ({ ...p, bankAccountName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBankModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBankSaved(true);
                                        setShowBankModal(false);
                                    }}
                                    disabled={!bankModal.bankName || !bankModal.bankAccountNumber || !bankModal.bankAccountName}
                                    className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                >
                                    Simpan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    if (account.status === "PENDING" || account.status === "SUSPENDED") {
        const isPendingReview = account.status === "PENDING";

        return (
            <div className="space-y-4">
                <div className={`rounded-xl border p-5 space-y-3 ${isPendingReview ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200" : "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-200"}`}>
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-semibold">
                                {isPendingReview ? "Pengajuan affiliate sedang direview" : "Akun affiliate sedang disuspend"}
                            </div>
                            <div className="text-sm opacity-90 mt-1">
                                {isPendingReview
                                    ? "Admin belum menyelesaikan peninjauan. Anda akan menerima notifikasi dan email setelah keputusan dibuat."
                                    : "Akses affiliate Anda sedang dinonaktifkan. Hubungi admin untuk bantuan lebih lanjut."}
                            </div>
                        </div>
                    </div>
                    <div className="text-sm">
                        Kode pengajuan: <strong>{account.code}</strong>
                    </div>
                    {account.reviewNotes && (
                        <div className="text-sm">
                            Catatan admin: {account.reviewNotes}
                        </div>
                    )}
                    {(account.bankName || account.bankAccountName) && (
                        <div className="text-sm">
                            Rekening: <strong>{account.bankName}</strong>
                            {account.bankAccountName ? ` a/n ${account.bankAccountName}` : ""}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // Dashboard (already enrolled)
    // ══════════════════════════════════════════════════════════════════════
    const link = `${baseUrl}?ref=${account.code}`;

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Link Anda</div>
                <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-slate-50 dark:bg-black/20 px-3 py-2 rounded-lg break-all">{link}</code>
                    <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Tersalin" : "Salin"}
                    </button>
                </div>
                <div className="text-xs text-slate-500">
                    Kode: <strong>{account.code}</strong> · Status: {" "}
                    <span className={account.status === "ACTIVE" ? "text-emerald-600" : "text-rose-600"}>
                        {account.status}
                    </span>
                    {account.fullName && <> · {account.fullName}</>}
                </div>
                {(account.bankName || account.bankAccountName) && (
                    <div className="text-xs text-slate-500">
                        Bank: <strong>{account.bankName}</strong>{account.bankAccountName && ` a/n ${account.bankAccountName}`}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Stat label="Klik" value={data.totals.clicks} />
                <Stat label="Konversi" value={data.totals.conversions} />
                <Stat label="Pending" value={`Rp ${data.totals.pending.toLocaleString("id-ID")}`} />
                <Stat label="Cleared" value={`Rp ${data.totals.cleared.toLocaleString("id-ID")}`} highlight />
                <Stat label="Reversed" value={`Rp ${data.totals.reversed.toLocaleString("id-ID")}`} />
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-brand-primary" />
                    <h3 className="font-bold">Atribusi Terbaru</h3>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.attributions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Belum ada konversi.</div>
                    ) : (
                        data.attributions.map((a) => (
                            <div key={a.id} className="p-4 text-sm flex items-start justify-between">
                                <div>
                                    <div className="font-mono text-xs text-slate-500">Order {a.orderId.slice(0, 8)}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(a.createdAt).toLocaleString("id-ID")} · rate {a.rate}%
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">Rp {a.commission.toLocaleString("id-ID")}</div>
                                    <div className={`text-xs ${a.status === "CLEARED" ? "text-emerald-600" : a.status === "REVERSED" ? "text-rose-600" : "text-amber-600"}`}>
                                        {a.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-lg font-bold ${highlight ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>
                {value}
            </div>
        </div>
    );
}


