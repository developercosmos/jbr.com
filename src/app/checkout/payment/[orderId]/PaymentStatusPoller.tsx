"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkInvoiceStatus } from "@/actions/payments";
import { Loader2 } from "lucide-react";

interface PaymentStatusPollerProps {
    paymentId: string;
}

export function PaymentStatusPoller({ paymentId }: PaymentStatusPollerProps) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        // Poll every 5 seconds for payment status
        const interval = setInterval(async () => {
            try {
                setIsChecking(true);
                const result = await checkInvoiceStatus(paymentId);

                if (result.status === "PAID") {
                    // Refresh the page to show updated status
                    router.refresh();
                } else if (result.status === "EXPIRED" || result.status === "FAILED") {
                    // Stop polling and refresh
                    clearInterval(interval);
                    router.refresh();
                }
            } catch (error) {
                console.error("Error checking payment status:", error);
            } finally {
                setIsChecking(false);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [paymentId, router]);

    return (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <div>
                    <p className="text-sm font-medium text-blue-900">
                        Menunggu konfirmasi pembayaran...
                    </p>
                    <p className="text-xs text-blue-600">
                        Halaman akan diperbarui otomatis setelah pembayaran berhasil
                    </p>
                </div>
            </div>
        </div>
    );
}
