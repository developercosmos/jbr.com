import { db } from "../src/db";
import { integration_settings } from "../src/db/schema";

async function insertIntegrations() {
    // Insert Postfix
    await db.insert(integration_settings).values({
        key: "postfix",
        name: "Postfix / SMTP",
        description: "Email server internal menggunakan Postfix SMTP untuk notifikasi sistem",
        category: "email",
        enabled: true,
        credentials: {},
        config: {
            smtp_host: "localhost",
            smtp_port: 25,
            from_email: "noreply@jualbeliraket.com",
            from_name: "JualBeliRaket",
            use_tls: false,
        },
    }).onConflictDoNothing();

    // Insert Midtrans
    await db.insert(integration_settings).values({
        key: "midtrans",
        name: "Midtrans",
        description: "Payment gateway populer dengan dukungan bank transfer, e-wallet, dan kartu kredit",
        category: "payment",
        enabled: false,
        credentials: {
            server_key: "",
            client_key: "",
        },
        config: {
            is_production: false,
            enable_3ds: true,
        },
    }).onConflictDoNothing();

    console.log("Integrations inserted successfully");
    process.exit(0);
}

insertIntegrations().catch((e) => {
    console.error(e);
    process.exit(1);
});
