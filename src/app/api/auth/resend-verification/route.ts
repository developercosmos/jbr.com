import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

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

