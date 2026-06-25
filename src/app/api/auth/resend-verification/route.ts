import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, verifications } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();
        const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

        if (!normalizedEmail) {
            return NextResponse.json(
                { error: "Email diperlukan" },
                { status: 400 }
            );
        }

        // Find the user
        const user = await db.query.users.findFirst({
            where: eq(users.email, normalizedEmail),
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

        // SECURITY: per-email cooldown to stop verification-email bombing of a victim
        // (this endpoint is unauthenticated by necessity — the user isn't logged in
        // yet). Uses the verifications table as a short-lived throttle store. Silent
        // success on throttle so we don't leak send-state.
        const throttleId = `resend_throttle:${normalizedEmail}`;
        const recent = await db.query.verifications.findFirst({
            where: and(eq(verifications.identifier, throttleId), gt(verifications.expires_at, new Date())),
            columns: { id: true },
        });
        if (recent) {
            return NextResponse.json({ success: true });
        }
        await db.insert(verifications).values({
            id: randomUUID(),
            identifier: throttleId,
            value: "1",
            expires_at: new Date(Date.now() + 60_000), // 60s cooldown
        });

        await auth.api.sendVerificationEmail({
            body: {
                email: normalizedEmail,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Resend verification error:", error);
        return NextResponse.json(
            { error: "Gagal mengirim email verifikasi" },
            { status: 500 }
        );
    }
}

