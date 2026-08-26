# Namecheap DNS module

Set `DNS_PROVIDER=namecheap` and configure the API user, key, username, and allow-listed public client IP. Set `NAMECHEAP_SANDBOX=true` while testing.

Namecheap replaces the complete host record set for each mutation. This module reads the current set, applies one change, then writes it back. It therefore serializes updates per application process; run DNS mutations through one web service instance or add a distributed lock when horizontally scaling.
