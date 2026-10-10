#!/bin/bash
# Asks for your Supabase connection string and writes it into .env.
# Special characters in the password (like !) are URL-encoded for you.
cd "$(dirname "$0")"
read -s -p "Paste DATABASE_URL (hidden): " URL; echo
python3 - "$URL" <<'PY'
import re, sys
from urllib.parse import quote
url = sys.argv[1].strip()
m = re.match(r"^(postgres(?:ql)?://[^:]+:)(.*)(@[^@]+)$", url)
if not m:
    sys.exit("That does not look like a postgresql:// connection string")
encoded = m.group(1) + quote(m.group(2), safe="%") + m.group(3)
lines = open(".env").read().splitlines()
lines = [("DATABASE_URL=" + encoded) if l.startswith("DATABASE_URL=") else l for l in lines]
open(".env", "w").write("\n".join(lines) + "\n")
print("Saved to .env")
PY
