#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/../.." && pwd)"
TMP_DIR="${ROOT_DIR}/.tmp"
CONFIG_DIR="${TMP_DIR}/config"
SECURITY_DIR="${TMP_DIR}/security"
CACHE_DIR="${TMP_DIR}/cache"
LOG_DIR="${TMP_DIR}/logs"
REGISTRY_HOST="127.0.0.1"
REGISTRY_PORT="8123"
REGISTRY_URL="http://${REGISTRY_HOST}:${REGISTRY_PORT}"

swiftpm_base_args() {
  SWIFTPM_BASE_ARGS=(
    "--config-path" "${CONFIG_DIR}"
    "--security-path" "${SECURITY_DIR}"
    "--cache-path" "${CACHE_DIR}"
  )
}

resolve_swiftpm_binaries() {
  local local_swift_package="${LOCAL_SWIFT_PACKAGE:-${REPO_ROOT}/.build/arm64-apple-macosx/debug/swift-package}"
  local local_swift_package_registry="${LOCAL_SWIFT_PACKAGE_REGISTRY:-${REPO_ROOT}/.build/arm64-apple-macosx/debug/swift-package-registry}"
  if [[ -x "${local_swift_package}" && -x "${local_swift_package_registry}" ]]; then
    SWIFT_PACKAGE_BIN="${local_swift_package}"
    SWIFT_PACKAGE_REGISTRY_BIN="${local_swift_package_registry}"
  else
    SWIFT_PACKAGE_BIN="swift package"
    SWIFT_PACKAGE_REGISTRY_BIN="swift package-registry"
  fi
}

package_dir() {
  case "${1}" in
    ascii) printf '%s\n' "${ROOT_DIR}/packages/demo-ascii" ;;
    unicode) printf '%s\n' "${ROOT_DIR}/packages/demo-unicode" ;;
    *) echo "unknown package variant: ${1}" >&2; return 1 ;;
  esac
}

consumer_dir() {
  case "${1}" in
    ascii) printf '%s\n' "${ROOT_DIR}/consumers/consumer-ascii" ;;
    unicode) printf '%s\n' "${ROOT_DIR}/consumers/consumer-unicode" ;;
    *) echo "unknown consumer variant: ${1}" >&2; return 1 ;;
  esac
}
