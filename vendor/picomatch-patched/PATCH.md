# Local security backport, CVE-2026-112366

Source: https://github.com/micromatch/picomatch/tree/4.0.7 (MIT, original LICENSE retained).
All runtime files are copied from that tag. Only lib/parse.js is modified.
The metadata has a distinct local package name so it does not represent an official
upstream release. No download, install script, third-party fork, or new runtime dependency is added.

The guard rejects repeated single-branch extglobs containing '*' or '?' by returning
the parser's existing risky/literal fallback before its optional recursion opt-out.
This intentionally changes matching semantics for these patterns (including literal
escaped wildcards conservatively), while leaving normal globs intact.
Vite, fdir and tinyglobby resolve the checked-in replacement via an npm override.
The existing lockfile-wide audit, secret scanning, build and tests remain required.
The regression test exercises the actual dependency with both normal and malicious patterns.
Remove the local override and vendor files once a verified upstream fix is available;
do not change the audit threshold to work around this advisory.

Upstream advisory: https://github.com/advisories/GHSA-fc5q-39xc-vjpf
