import nodemailer from "nodemailer";

// SMTP Configuration - use 127.0.0.1 explicitly to avoid IPv6 issues
const SMTP_HOST = process.env.SMTP_HOST || "127.0.0.1";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "25");

console.log(`[Email] SMTP Config: host=${SMTP_HOST}, port=${SMTP_PORT}`);

// Create reusable transporter using Postfix
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: {
        rejectUnauthorized: false,
    },
});

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@jualbeliraket.com";
const APP_NAME = "JualBeliRaket";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com";

// ============================================
// EMAIL TEMPLATES
// ============================================

function getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #0066FF; font-size: 24px; margin: 0; font-weight: 700; }
        .button { display: inline-block; background: #0066FF; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #0052cc; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .footer a { color: #0066FF; text-decoration: none; }
        .divider { border-top: 1px solid #e2e8f0; margin: 30px 0; }
        h2 { color: #1e293b; font-size: 22px; margin: 0 0 20px 0; }
        p { margin: 0 0 16px 0; color: #475569; }
        .highlight { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #0066FF; }
        .order-item { display: flex; padding: 15px 0; border-bottom: 1px solid #e2e8f0; }
        .price { font-weight: 700; color: #0066FF; font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo">
                <h1>🏸 ${APP_NAME}</h1>
            </div>
            ${content}
        </div>
        <div class="footer">
            <p>Email ini dikirim oleh ${APP_NAME}</p>
            <p><a href="${APP_URL}">${APP_URL}</a></p>
            <p style="margin-top: 15px; font-size: 12px;">
                Jika Anda tidak merasa melakukan aksi ini, abaikan email ini.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

// ============================================
// EMAIL FUNCTIONS
// ============================================

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

async function sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
        await transporter.sendMail({
            from: `"${APP_NAME}" <${FROM_EMAIL}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });
        console.log(`Email sent successfully to ${options.to}`);
        return true;
    } catch (error) {
        console.error("Failed to send email:", error);
        return false;
    }
}

// ============================================
// PASSWORD RESET
// ============================================

export async function sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName?: string
): Promise<boolean> {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${resetToken}`;

    const content = `
        <h2>Reset Password</h2>
        <p>Halo${userName ? ` ${userName}` : ""},</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda di ${APP_NAME}.</p>
        <p>Klik tombol di bawah untuk membuat password baru:</p>
        <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </p>
        <div class="highlight">
            <p style="margin: 0;"><strong>⏰ Link ini akan kedaluwarsa dalam 1 jam.</strong></p>
        </div>
        <p style="margin-top: 20px; font-size: 14px; color: #64748b;">
            Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Reset Password - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// REGISTRATION / WELCOME
// ============================================

export async function sendWelcomeEmail(
    email: string,
    userName: string
): Promise<boolean> {
    const content = `
        <h2>Selamat Datang di ${APP_NAME}! 🎉</h2>
        <p>Halo ${userName},</p>
        <p>Terima kasih telah mendaftar di ${APP_NAME} - marketplace raket badminton terpercaya di Indonesia!</p>
        <div class="highlight">
            <p style="margin: 0;"><strong>Apa yang bisa Anda lakukan sekarang?</strong></p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Jelajahi koleksi raket dari berbagai brand</li>
                <li>Mulai jual raket Anda sendiri</li>
                <li>Dapatkan penawaran terbaik dari seller terpercaya</li>
            </ul>
        </div>
        <p style="text-align: center;">
            <a href="${APP_URL}" class="button">Mulai Belanja</a>
        </p>
        <p>Jika ada pertanyaan, jangan ragu untuk menghubungi kami.</p>
        <p>Selamat berbelanja! 🏸</p>
    `;

    return sendEmail({
        to: email,
        subject: `Selamat Datang di ${APP_NAME}! 🏸`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// EMAIL VERIFICATION
// ============================================

export async function sendVerificationEmail(
    email: string,
    verifyToken: string,
    userName?: string
): Promise<boolean> {
    const verifyUrl = `${APP_URL}/auth/verify-email?token=${verifyToken}`;

    const content = `
        <h2>Verifikasi Email Anda</h2>
        <p>Halo${userName ? ` ${userName}` : ""},</p>
        <p>Terima kasih telah mendaftar di ${APP_NAME}!</p>
        <p>Silakan verifikasi email Anda dengan mengklik tombol di bawah:</p>
        <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">Verifikasi Email</a>
        </p>
        <p style="font-size: 14px; color: #64748b;">
            Atau copy link berikut ke browser: <br>
            <a href="${verifyUrl}" style="color: #0066FF;">${verifyUrl}</a>
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Verifikasi Email - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// ORDER NOTIFICATIONS
// ============================================

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    image?: string;
}

interface OrderDetails {
    orderId: string;
    items: OrderItem[];
    total: number;
    shippingAddress: string;
    paymentMethod: string;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

function renderOrderItems(items: OrderItem[]): string {
    return items.map(item => `
        <div style="display: flex; padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600;">${item.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Qty: ${item.quantity}</p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600;">${formatCurrency(item.price * item.quantity)}</p>
            </div>
        </div>
    `).join("");
}

// Object-based params that matches existing payments.ts usage
interface OrderConfirmationParams {
    orderNumber: string;
    buyerName: string | null;
    buyerEmail: string;
    items: Array<{ title: string; quantity: number; price: string }>;
    subtotal: string;
    shippingCost: string;
    total: string;
}

export async function sendOrderConfirmationEmail(params: OrderConfirmationParams): Promise<boolean> {
    const itemsHtml = params.items.map(item => `
        <div style="display: flex; padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600;">${item.title}</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Qty: ${item.quantity}</p>
            </div>
            <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600;">${item.price}</p>
            </div>
        </div>
    `).join("");

    const content = `
        <h2>Pesanan Dikonfirmasi! ✅</h2>
        <p>Halo ${params.buyerName || "Pelanggan"},</p>
        <p>Terima kasih atas pesanan Anda! Berikut detail pesanan:</p>
        
        <div class="highlight">
            <p style="margin: 0;"><strong>Order:</strong> #${params.orderNumber}</p>
        </div>
        
        <div class="divider"></div>
        
        <h3 style="font-size: 16px; margin-bottom: 10px;">Item Pesanan</h3>
        ${itemsHtml}
        
        <div style="padding: 15px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #64748b;">Subtotal</span>
                <span>${params.subtotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #64748b;">Ongkir</span>
                <span>${params.shippingCost}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 18px; color: #0066FF;">
                <span>Total</span>
                <span>${params.total}</span>
            </div>
        </div>
        
        <p style="text-align: center; margin-top: 30px;">
            <a href="${APP_URL}/profile/orders" class="button">Lihat Pesanan</a>
        </p>
    `;

    return sendEmail({
        to: params.buyerEmail,
        subject: `Pesanan #${params.orderNumber} Dikonfirmasi - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

export async function sendOrderShippedEmail(
    email: string,
    userName: string,
    orderId: string,
    trackingNumber: string,
    courierName: string
): Promise<boolean> {
    const content = `
        <h2>Pesanan Dikirim! 🚚</h2>
        <p>Halo ${userName},</p>
        <p>Kabar baik! Pesanan Anda sudah dalam perjalanan.</p>
        
        <div class="highlight">
            <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> #${orderId}</p>
            <p style="margin: 0 0 10px 0;"><strong>Kurir:</strong> ${courierName}</p>
            <p style="margin: 0;"><strong>No. Resi:</strong> ${trackingNumber}</p>
        </div>
        
        <p style="text-align: center; margin-top: 30px;">
            <a href="${APP_URL}/profile/orders/${orderId}" class="button">Lacak Pesanan</a>
        </p>
        
        <p style="font-size: 14px; color: #64748b;">
            Estimasi pengiriman tergantung lokasi dan jasa pengiriman yang digunakan.
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Pesanan #${orderId} Dikirim - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

export async function sendOrderDeliveredEmail(
    email: string,
    userName: string,
    orderId: string
): Promise<boolean> {
    const content = `
        <h2>Pesanan Sampai! 🎉</h2>
        <p>Halo ${userName},</p>
        <p>Pesanan Anda #${orderId} sudah sampai di tujuan!</p>
        
        <p>Kami harap Anda puas dengan pembelian Anda. Jangan lupa untuk memberikan ulasan 
        agar seller dan pembeli lain dapat terbantu.</p>
        
        <p style="text-align: center;">
            <a href="${APP_URL}/profile/orders/${orderId}" class="button">Beri Ulasan</a>
        </p>
        
        <p style="font-size: 14px; color: #64748b;">
            Ada masalah dengan pesanan? <a href="${APP_URL}/help" style="color: #0066FF;">Hubungi kami</a>
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Pesanan #${orderId} Sudah Sampai - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// SELLER NOTIFICATIONS
// ============================================

export async function sendNewOrderNotificationToSeller(
    email: string,
    sellerName: string,
    orderId: string,
    buyerName: string,
    items: OrderItem[],
    total: number
): Promise<boolean> {
    const content = `
        <h2>Pesanan Baru! 🛎️</h2>
        <p>Halo ${sellerName},</p>
        <p>Anda menerima pesanan baru dari <strong>${buyerName}</strong>!</p>
        
        <div class="highlight">
            <p style="margin: 0;"><strong>Order ID:</strong> #${orderId}</p>
        </div>
        
        <div class="divider"></div>
        
        <h3 style="font-size: 16px; margin-bottom: 10px;">Item Pesanan</h3>
        ${renderOrderItems(items)}
        
        <div style="padding: 15px 0; text-align: right;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Total</p>
            <p class="price" style="margin: 5px 0 0 0;">${formatCurrency(total)}</p>
        </div>
        
        <p style="text-align: center; margin-top: 30px;">
            <a href="${APP_URL}/seller/orders/${orderId}" class="button">Proses Pesanan</a>
        </p>
        
        <p style="font-size: 14px; color: #64748b;">
            ⏰ Harap proses pesanan dalam 2x24 jam untuk menjaga rating toko Anda.
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `🛎️ Pesanan Baru #${orderId} - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

export async function sendProductApprovedEmail(
    email: string,
    sellerName: string,
    productName: string,
    productSlug: string
): Promise<boolean> {
    const content = `
        <h2>Produk Disetujui! ✅</h2>
        <p>Halo ${sellerName},</p>
        <p>Selamat! Produk Anda telah disetujui dan sekarang sudah live di marketplace.</p>
        
        <div class="highlight">
            <p style="margin: 0;"><strong>Produk:</strong> ${productName}</p>
        </div>
        
        <p style="text-align: center;">
            <a href="${APP_URL}/product/${productSlug}" class="button">Lihat Produk</a>
        </p>
        
        <p style="font-size: 14px; color: #64748b;">
            Tips: Promosikan produk di media sosial untuk meningkatkan penjualan! 🚀
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Produk "${productName}" Disetujui - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

export async function sendProductRejectedEmail(
    email: string,
    sellerName: string,
    productName: string,
    reason: string
): Promise<boolean> {
    const content = `
        <h2>Produk Perlu Perbaikan</h2>
        <p>Halo ${sellerName},</p>
        <p>Mohon maaf, produk Anda belum dapat ditampilkan di marketplace.</p>
        
        <div class="highlight">
            <p style="margin: 0 0 10px 0;"><strong>Produk:</strong> ${productName}</p>
            <p style="margin: 0;"><strong>Alasan:</strong> ${reason}</p>
        </div>
        
        <p>Silakan perbaiki dan ajukan kembali produk Anda.</p>
        
        <p style="text-align: center;">
            <a href="${APP_URL}/seller/products" class="button">Kelola Produk</a>
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `Produk "${productName}" Perlu Perbaikan - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// PAYMENT NOTIFICATIONS
// ============================================

interface PaymentSuccessParams {
    orderNumber: string;
    buyerName: string | null;
    buyerEmail: string;
    paymentMethod: string;
    amount: string;
    paidAt: string;
}

export async function sendPaymentSuccessEmail(params: PaymentSuccessParams): Promise<boolean> {
    const content = `
        <h2>Pembayaran Berhasil! 💳</h2>
        <p>Halo ${params.buyerName || "Pelanggan"},</p>
        <p>Terima kasih! Pembayaran Anda telah berhasil diproses.</p>
        
        <div class="highlight">
            <p style="margin: 0 0 10px 0;"><strong>Order:</strong> #${params.orderNumber}</p>
            <p style="margin: 0 0 10px 0;"><strong>Jumlah:</strong> ${params.amount}</p>
            <p style="margin: 0 0 10px 0;"><strong>Metode:</strong> ${params.paymentMethod}</p>
            <p style="margin: 0;"><strong>Waktu:</strong> ${params.paidAt}</p>
        </div>
        
        <p>Pesanan Anda sedang diproses oleh seller. Kami akan kabari Anda saat pesanan dikirim.</p>
        
        <p style="text-align: center;">
            <a href="${APP_URL}/profile/orders" class="button">Lihat Pesanan</a>
        </p>
    `;

    return sendEmail({
        to: params.buyerEmail,
        subject: `Pembayaran Berhasil #${params.orderNumber} - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

export async function sendPaymentReminderEmail(
    email: string,
    userName: string,
    orderId: string,
    amount: number,
    expiresAt: Date
): Promise<boolean> {
    const expiryTime = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeStyle: "short",
    }).format(expiresAt);

    const content = `
        <h2>Jangan Lupa Bayar! ⏰</h2>
        <p>Halo ${userName},</p>
        <p>Pesanan Anda belum dibayar. Segera selesaikan pembayaran agar tidak kedaluwarsa.</p>
        
        <div class="highlight">
            <p style="margin: 0 0 10px 0;"><strong>Order ID:</strong> #${orderId}</p>
            <p style="margin: 0 0 10px 0;"><strong>Total:</strong> ${formatCurrency(amount)}</p>
            <p style="margin: 0; color: #dc2626;"><strong>⏰ Batas waktu:</strong> ${expiryTime}</p>
        </div>
        
        <p style="text-align: center;">
            <a href="${APP_URL}/payment/${orderId}" class="button">Bayar Sekarang</a>
        </p>
    `;

    return sendEmail({
        to: email,
        subject: `⏰ Segera Bayar Pesanan #${orderId} - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// ============================================
// SHIPPING NOTIFICATION (for shipping.ts)
// ============================================

interface ShippingNotificationParams {
    orderNumber: string;
    buyerName: string | null;
    buyerEmail: string;
    trackingNumber: string;
    shippingProvider: string;
    trackingUrl: string;
}

export async function sendShippingNotificationEmail(params: ShippingNotificationParams): Promise<boolean> {
    const content = `
        <h2>Pesanan Dikirim! 🚚</h2>
        <p>Halo ${params.buyerName || "Pelanggan"},</p>
        <p>Kabar baik! Pesanan Anda sudah dalam perjalanan.</p>
        
        <div class="highlight">
            <p style="margin: 0 0 10px 0;"><strong>Order:</strong> #${params.orderNumber}</p>
            <p style="margin: 0 0 10px 0;"><strong>Kurir:</strong> ${params.shippingProvider}</p>
            <p style="margin: 0;"><strong>No. Resi:</strong> ${params.trackingNumber}</p>
        </div>
        
        <p style="text-align: center; margin-top: 30px;">
            <a href="${params.trackingUrl}" class="button">Lacak Pengiriman</a>
        </p>
        
        <p style="font-size: 14px; color: #64748b;">
            Estimasi pengiriman tergantung lokasi dan jasa pengiriman yang digunakan.
        </p>
    `;

    return sendEmail({
        to: params.buyerEmail,
        subject: `Pesanan #${params.orderNumber} Dikirim - ${APP_NAME}`,
        html: getBaseTemplate(content),
    });
}

// Export transporter for testing
export { transporter };
