"use server";

import { Resend } from "resend";

// Initialize Resend with API key (use dummy key for build if not set)
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_build");

const FROM_EMAIL = process.env.FROM_EMAIL || "JBR Marketplace <noreply@jbr.com>";

// ============================================
// EMAIL TEMPLATES
// ============================================

interface OrderEmailData {
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    items: Array<{
        title: string;
        quantity: number;
        price: string;
    }>;
    subtotal: string;
    shippingCost: string;
    total: string;
}

export async function sendOrderConfirmationEmail(data: OrderEmailData) {
    const itemsHtml = data.items
        .map(
            (item) => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${item.title}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.price}</td>
            </tr>
        `
        )
        .join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Pesanan Berhasil Dibuat! 🎉</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Halo <strong>${data.buyerName}</strong>,
                </p>
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Terima kasih telah berbelanja di JBR Marketplace. Pesanan Anda telah berhasil dibuat dengan nomor order:
                </p>
                
                <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: bold; color: #1e293b;">${data.orderNumber}</span>
                </div>
                
                <!-- Order Items -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Produk</th>
                            <th style="padding: 12px; text-align: center; color: #64748b; font-size: 12px; text-transform: uppercase;">Qty</th>
                            <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; text-transform: uppercase;">Harga</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <!-- Totals -->
                <div style="border-top: 2px solid #e2e8f0; padding-top: 16px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #64748b;">Subtotal</span>
                        <span style="color: #1e293b;">${data.subtotal}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #64748b;">Ongkos Kirim</span>
                        <span style="color: #1e293b;">${data.shippingCost}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 16px; padding-top: 16px; border-top: 2px solid #e2e8f0;">
                        <span style="color: #1e293b;">Total</span>
                        <span style="color: #2563eb;">${data.total}</span>
                    </div>
                </div>
                
                <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
                    Silakan selesaikan pembayaran Anda untuk memproses pesanan.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2026 JBR Marketplace. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to: data.buyerEmail,
            subject: `Pesanan ${data.orderNumber} - Menunggu Pembayaran`,
            html,
        });
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error("Failed to send order confirmation email:", error);
        return { success: false, error };
    }
}

interface PaymentSuccessEmailData {
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    paymentMethod: string;
    amount: string;
    paidAt: string;
}

export async function sendPaymentSuccessEmail(data: PaymentSuccessEmailData) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Pembayaran Berhasil! ✅</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Halo <strong>${data.buyerName}</strong>,
                </p>
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Pembayaran Anda untuk pesanan <strong>${data.orderNumber}</strong> telah berhasil diterima.
                </p>
                
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Metode Pembayaran</td>
                            <td style="color: #1e293b; text-align: right; font-weight: 600;">${data.paymentMethod}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Jumlah</td>
                            <td style="color: #22c55e; text-align: right; font-weight: 600; font-size: 18px;">${data.amount}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Waktu Pembayaran</td>
                            <td style="color: #1e293b; text-align: right;">${data.paidAt}</td>
                        </tr>
                    </table>
                </div>
                
                <p style="color: #475569; font-size: 16px;">
                    Pesanan Anda sedang diproses oleh penjual. Kami akan mengirimkan notifikasi setelah pesanan dikirim.
                </p>
                
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/profile/orders" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                    Lihat Status Pesanan
                </a>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2026 JBR Marketplace. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to: data.buyerEmail,
            subject: `Pembayaran Berhasil - ${data.orderNumber}`,
            html,
        });
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error("Failed to send payment success email:", error);
        return { success: false, error };
    }
}

interface ShippingEmailData {
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    trackingNumber: string;
    shippingProvider: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
}

export async function sendShippingNotificationEmail(data: ShippingEmailData) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Pesanan Dalam Pengiriman! 📦</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Halo <strong>${data.buyerName}</strong>,
                </p>
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Pesanan <strong>${data.orderNumber}</strong> telah dikirim! Berikut adalah informasi pengiriman Anda:
                </p>
                
                <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Kurir</td>
                            <td style="color: #1e293b; text-align: right; font-weight: 600;">${data.shippingProvider}</td>
                        </tr>
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Nomor Resi</td>
                            <td style="color: #f59e0b; text-align: right; font-weight: 600; font-size: 18px;">${data.trackingNumber}</td>
                        </tr>
                        ${data.estimatedDelivery ? `
                        <tr>
                            <td style="color: #64748b; padding: 8px 0;">Estimasi Tiba</td>
                            <td style="color: #1e293b; text-align: right;">${data.estimatedDelivery}</td>
                        </tr>
                        ` : ''}
                    </table>
                </div>
                
                <p style="color: #64748b; font-size: 14px;">
                    Anda dapat melacak pengiriman melalui website kurir dengan nomor resi di atas.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2026 JBR Marketplace. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to: data.buyerEmail,
            subject: `Pesanan Dikirim - ${data.orderNumber}`,
            html,
        });
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error("Failed to send shipping notification email:", error);
        return { success: false, error };
    }
}

interface NewMessageEmailData {
    recipientName: string;
    recipientEmail: string;
    senderName: string;
    messagePreview: string;
    conversationUrl: string;
}

export async function sendNewMessageEmail(data: NewMessageEmailData) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Pesan Baru 💬</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Halo <strong>${data.recipientName}</strong>,
                </p>
                <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                    Anda mendapat pesan baru dari <strong>${data.senderName}</strong>:
                </p>
                
                <div style="background: #f5f3ff; border-left: 4px solid #8b5cf6; border-radius: 0 12px 12px 0; padding: 16px 24px; margin-bottom: 24px;">
                    <p style="color: #1e293b; font-size: 16px; margin: 0; font-style: italic;">
                        "${data.messagePreview}"
                    </p>
                </div>
                
                <a href="${data.conversationUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Balas Pesan
                </a>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    © 2026 JBR Marketplace. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to: data.recipientEmail,
            subject: `Pesan baru dari ${data.senderName}`,
            html,
        });
        return { success: true, id: result.data?.id };
    } catch (error) {
        console.error("Failed to send new message email:", error);
        return { success: false, error };
    }
}
