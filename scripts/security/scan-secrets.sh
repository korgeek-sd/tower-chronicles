#!/usr/bin/env bash
set -euo pipefail
# Official MIT-licensed CLI, pinned release and SHA-256; no third-party action/license server.
archive=gitleaks_8.30.1_linux_x64.tar.gz
checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
 "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/$archive" -o "$scan_dir/$archive"
(cd "$scan_dir" && printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status)
tar --no-same-owner -xzf "$scan_dir/$archive" -C "$scan_dir" gitleaks
"$scan_dir/gitleaks" git --report-format=json --report-path="${GITLEAKS_REPORT_PATH:-/dev/null}" --redact=100 --no-banner --log-level=warn --log-opts=--all .
