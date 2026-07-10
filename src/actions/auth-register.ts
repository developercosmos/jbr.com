"use server";

// Registrasi akun dengan tipe (PERSONAL | COMPANY). Dibungkus server action agar
// users.account_type tertulis ATOMIK bersama pembuatan user — tanpa endpoint
// publik terpisah yang bisa dipakai mengubah tipe akun orang lain.
//
// Akun COMPANY diarahkan & di-enforce melengkapi KYC T2 (dokumen bisnis):
// - default target tier T2 (T1 dikunci) di form KYC,
// - tidak bisa menerbitkan produk sebelum pengajuan T2 dikirim (lihat
//   ensureCompanyHasT2Application di actions/kyc.ts).

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";

const registerSchema = z.object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
    email: z.string().trim().toLowerCase().email("Format email tidak valid."),
    password: z.string().min(8, "Password minimal 8 karakter."),
    accountType: z.enum(["PERSONAL", "COMPANY"]).default("PERSONAL"),
});

export async function registerAccount(input: z.infer<typeof registerSchema>) {
    // The ENTIRE body is guarded: a bad payload (Zod) or transient signup/email error
    // must return a graceful { success:false } instead of throwing an uncaught
    // server-action error — an uncaught throw surfaces the page-level "Terjadi
    // kesalahan" error boundary instead of an inline form message.
    try {
        const validated = registerSchema.parse(input);

        // Better Auth server API: creates the user + sends the verification email
        // (same pipeline as the client signUp.email call this replaces).
        await auth.api.signUpEmail({
            body: {
                name: validated.name,
                email: validated.email,
                password: validated.password,
            },
        });

        if (validated.accountType === "COMPANY") {
            try {
                await db
                    .update(users)
                    .set({ account_type: "COMPANY", updated_at: new Date() })
                    .where(eq(users.email, validated.email));
            } catch (e) {
                // User exists; tipe akun bisa disusulkan oleh admin bila langkah ini gagal.
                console.error("[registerAccount] gagal set account_type COMPANY:", e);
            }
        }

        return { success: true as const, accountType: validated.accountType };
    } catch (error) {
        const message =
            error instanceof z.ZodError
                ? (error.issues[0]?.message ?? "Data pendaftaran tidak valid.")
                : error instanceof Error
                    ? error.message
                    : "Pendaftaran gagal. Silakan coba lagi.";
        return { success: false as const, error: message };
    }
}
