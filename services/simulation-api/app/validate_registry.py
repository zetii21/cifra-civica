"""Command-line registry validation used by CI."""

from .config import load_settings
from .registry import PolicyRegistry


def main() -> int:
    registry = PolicyRegistry(load_settings())
    print(f"Policy registry valid: {registry.registry_version}; {len(registry.public_policies())} published policies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
