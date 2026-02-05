import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, verifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email diperlukan" },
                { status: 400 }
            );
        }

        // Find the user
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            // Don't reveal if user exists or not
            return NextResponse.json({ success: true });
        }

        // Check if already verified
        if (user.email_verified) {
            return NextResponse.json(
                { error: "Email sudah terverifikasi" },
                { status: 400 }
            );
        }

        // Generate new verification token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Delete any existing verification for this email
        await db.delete(verifications).where(eq(verifications.identifier, email));

        // Insert new verification token
        await db.insert(verifications).values({
            id: crypto.randomUUID(),
            identifier: email,
            value: token,
            expires_at: expiresAt,
        });

        // Send verification email
        await sendVerificationEmail(email, token, user.name || undefined);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json(
            { error: "Gagal mengirim email verifikasi" },
            { status: 500 }
        );
    }
}

