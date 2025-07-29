#!/bin/bash

# Generate SDKs from OpenAPI specification
# This script uses OpenAPI Generator to create client SDKs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OPENAPI_SPEC="$ROOT_DIR/docs/openapi.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${GREEN}==== $1 ====${NC}"
}

print_error() {
    echo -e "${RED}Error: $1${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

# Check if OpenAPI Generator is installed
check_openapi_generator() {
    if ! command -v openapi-generator-cli &> /dev/null; then
        print_error "openapi-generator-cli not found!"
        print_info "Install it with: npm install -g @openapitools/openapi-generator-cli"
        exit 1
    fi
}

# Generate OpenAPI spec
generate_spec() {
    print_header "Generating OpenAPI Specification"
    cd "$ROOT_DIR"
    
    # Run the generate command to create OpenAPI spec
    bun run packages/kuuzuki/src/index.ts generate > "$OPENAPI_SPEC"
    
    print_info "OpenAPI spec generated at: $OPENAPI_SPEC"
}

# Generate TypeScript SDK
generate_typescript_sdk() {
    print_header "Generating TypeScript SDK"
    
    openapi-generator-cli generate \
        -i "$OPENAPI_SPEC" \
        -g typescript-fetch \
        -o "$ROOT_DIR/packages/kuuzuki-sdk-ts" \
        --additional-properties=npmName=@moikas/kuuzuki-sdk,npmVersion=0.1.0,supportsES6=true
    
    # Update package.json with our custom values
    cd "$ROOT_DIR/packages/kuuzuki-sdk-ts"
    # The package.json is already set up
    
    print_info "TypeScript SDK generated at: packages/kuuzuki-sdk-ts"
}

# Generate Python SDK
generate_python_sdk() {
    print_header "Generating Python SDK"
    
    openapi-generator-cli generate \
        -i "$OPENAPI_SPEC" \
        -g python \
        -o "$ROOT_DIR/packages/kuuzuki-sdk-py" \
        --additional-properties=packageName=kuuzuki_sdk,projectName=kuuzuki-sdk,packageVersion=0.1.0
    
    print_info "Python SDK generated at: packages/kuuzuki-sdk-py"
}

# Main execution
main() {
    print_header "Kuuzuki SDK Generation"
    
    check_openapi_generator
    generate_spec
    generate_typescript_sdk
    generate_python_sdk
    
    print_header "SDK Generation Complete!"
    print_info "Next steps:"
    print_info "1. Review the generated code"
    print_info "2. Test the SDKs"
    print_info "3. Publish to package registries"
}

main "$@"