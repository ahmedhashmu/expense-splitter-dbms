#!/bin/bash
# Asks for your Supabase connection string and writes it into .env.
# Cleans stray text from the paste, URL-encodes special characters in the
# password, and shows what it saved (password hidden) so you can check it.
cd "$(dirname "$0")" || exit 1
read -s -p "Paste DATABASE_URL (hidden): " URL; echo
python3 - "$URL" <<'PY'
import re, sys
from urllib.parse import quote, unquote

raw = re.sub(r"\x1b\[[0-9;?]*[~A-Za-z]", "", sys.argv[1])   # terminal paste markers
m = re.search(r"postgres(?:ql)?://([^:/@\s]+):([^@\s]+)@([A-Za-z0-9.\-]+):(\d+)/postgres", raw)
if not m:
    sys.exit("Could not find a postgresql://user:password@host:port/postgres string in what you pasted.")
user, password, host, port = m.groups()
if "[" in password or "]" in password:
    sys.exit("The password still has [ ] in it. Replace [YOUR-PASSWORD] with the real password.")
url = f"postgresql://{user}:{quote(unquote(password), safe='')}@{host}:{port}/postgres"

lines = open(".env").read().splitlines()
lines = [("DATABASE_URL=" + url) if l.startswith("DATABASE_URL=") else l for l in lines]
open(".env", "w").write("\n".join(lines) + "\n")

print("Saved. Please check:")
print("  user    :", user)
print("  host    :", host)
print("  port    :", port)
print("  password:", len(unquote(password)), "characters (hidden)")
PY
