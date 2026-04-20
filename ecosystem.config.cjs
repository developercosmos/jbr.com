module.exports = {
    apps: [
        {
            name: "jualbeliraket",
            script: ".next/standalone/server.js",
            cwd: "/var/www/jbr",
            env: {
                NODE_ENV: "production",
                PORT: 3000,
                HOSTNAME: "0.0.0.0",
            },
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            // Logging
            error_file: "/var/www/jbr/logs/pm2-error.log",
            out_file: "/var/www/jbr/logs/pm2-out.log",
            merge_logs: true,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        },
    ],
};
