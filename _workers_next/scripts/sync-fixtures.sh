#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
workers_dir="$(cd "${script_dir}/.." && pwd)"

if [[ $# -gt 0 ]]; then
  bot_repo="$(cd "$1" && pwd)"
else
  bot_repo="$(cd "${workers_dir}/../../remnawave" && pwd)"
fi

fixture_dir=".trellis/tasks/05-11-web-payment-ui-ldc-integration/fixtures"
dest_dir="test-fixtures"

cd "${workers_dir}"
mkdir -p "${dest_dir}"

for file in prorate_fixtures.json tier_fixtures.json; do
  cp "${bot_repo}/${fixture_dir}/${file}" "${dest_dir}/${file}"
done

{
  printf 'Source: %s/%s\n' "${bot_repo}" "${fixture_dir}"
  printf 'Synced at: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '\n'
  for file in prorate_fixtures.json tier_fixtures.json; do
    if command -v sha256sum >/dev/null 2>&1; then
      checksum="$(sha256sum "${dest_dir}/${file}" | awk '{print $1}')"
    else
      checksum="$(shasum -a 256 "${dest_dir}/${file}" | awk '{print $1}')"
    fi
    printf '%s  %s\n' "${checksum}" "${file}"
  done
} > "${dest_dir}/PROVENANCE.txt"
