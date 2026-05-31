#!/bin/bash
# OpenDKIM Config Setup Script

# Create TrustedHosts
cat > /etc/opendkim/TrustedHosts << 'EOF'
127.0.0.1
localhost
jualbeliraket.com
EOF

# Create KeyTable
cat > /etc/opendkim/KeyTable << 'EOF'
default._domainkey.jualbeliraket.com jualbeliraket.com:default:/etc/opendkim/keys/jualbeliraket.com/default.private
EOF

# Create SigningTable  
cat > /etc/opendkim/SigningTable << 'EOF'
*@jualbeliraket.com default._domainkey.jualbeliraket.com
EOF

# Set permissions
chown opendkim:opendkim /etc/opendkim/TrustedHosts /etc/opendkim/KeyTable /etc/opendkim/SigningTable

# Restart services
systemctl restart opendkim
systemctl restart postfix

# Output DKIM key for DNS
echo ""
echo "=== DKIM DNS RECORD (add to Cloudflare) ==="
cat /etc/opendkim/keys/jualbeliraket.com/default.txt
echo ""
echo "=== Service Status ==="
systemctl status opendkim --no-pager | head -5
systemctl status postfix --no-pager | head -5
