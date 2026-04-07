#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

MODE="${1:-truncate-non-ascii-when-quoted-printable}"

rm -rf "${TMP_DIR}"
mkdir -p "${CONFIG_DIR}" "${SECURITY_DIR}" "${CACHE_DIR}" "${LOG_DIR}" "${TMP_DIR}/registry-store" "${TMP_DIR}/captures"

(
  cd "${ROOT_DIR}"
  REGISTRY_MODE="${MODE}" REGISTRY_HOST="${REGISTRY_HOST}" REGISTRY_PORT="${REGISTRY_PORT}" REGISTRY_ROOT_DIR="${TMP_DIR}" \
    node "${ROOT_DIR}/server/mock-registry.js" > "${LOG_DIR}/demo-registry.log" 2>&1
) &
server_pid=$!
trap 'kill ${server_pid} >/dev/null 2>&1 || true' EXIT
sleep 1

swiftpm_base_args
resolve_swiftpm_binaries

echo "using:"
echo "  package: ${SWIFT_PACKAGE_BIN}"
echo "  registry: ${SWIFT_PACKAGE_REGISTRY_BIN}"

echo "== publish ascii =="
cd "$(package_dir ascii)"
"${SWIFT_PACKAGE_REGISTRY_BIN}" "${SWIFTPM_BASE_ARGS[@]}" publish demo.ascii 1.0.0 --url "${REGISTRY_URL}" --allow-insecure-http

echo "== resolve ascii =="
cd "$(consumer_dir ascii)"
"${SWIFT_PACKAGE_BIN}" "${SWIFTPM_BASE_ARGS[@]}" resolve --default-registry-url "${REGISTRY_URL}" --disable-sandbox --disable-keychain --disable-netrc
echo "resolved ascii successfully"

echo "== publish unicode =="
cd "$(package_dir unicode)"
"${SWIFT_PACKAGE_REGISTRY_BIN}" "${SWIFTPM_BASE_ARGS[@]}" publish demo.unicode 1.0.0 --url "${REGISTRY_URL}" --allow-insecure-http

echo "== resolve unicode =="
cd "$(consumer_dir unicode)"
"${SWIFT_PACKAGE_BIN}" "${SWIFTPM_BASE_ARGS[@]}" resolve --default-registry-url "${REGISTRY_URL}" --disable-sandbox --disable-keychain --disable-netrc
echo "resolved unicode successfully"
echo "demo completed successfully"
