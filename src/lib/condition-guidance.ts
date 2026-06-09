// Transparency guidance text for a pre-loved condition rating (1–10).
// Used by the product form's "Detail Kondisi" slider so the narration tracks the
// slider value instead of being fixed.
export function conditionGuidance(rating: number): string {
    const r = Math.max(1, Math.min(10, Math.round(rating)));
    if (r <= 2) {
        return `Kondisi ${r}/10 (rusak parah): barang memiliki kerusakan signifikan atau cacat pada fungsi. Jelaskan kerusakan secara rinci dan tampilkan SEMUA cacat di foto.`;
    }
    if (r <= 4) {
        return `Kondisi ${r}/10: terdapat cacat/kerusakan yang cukup terlihat dan dapat memengaruhi pemakaian. Foto wajib menampilkan seluruh cacat.`;
    }
    if (r <= 6) {
        return `Kondisi ${r}/10 (layak pakai): ada bekas pemakaian atau cacat kosmetik yang terlihat, namun fungsi utama masih bekerja. Tunjukkan cacatnya di foto.`;
    }
    if (r <= 8) {
        return `Kondisi ${r}/10: hanya sedikit lecet kosmetik, fungsi utama masih sempurna. Pastikan foto menunjukkan cacat kecil tersebut.`;
    }
    return `Kondisi ${r}/10 (like new): nyaris seperti baru, bekas pemakaian minim atau tidak ada. Tetap tampilkan kondisi asli di foto.`;
}
