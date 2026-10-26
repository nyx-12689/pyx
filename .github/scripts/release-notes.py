"""Prints the GitHub release notes for a version: its CHANGELOG.md section, then how to download.

usage: python3 .github/scripts/release-notes.py v0.1.0

Fails if CHANGELOG.md has no section for the version, so no release ships without one.
Release notes keep every line break, so any wrapped lines are joined back into paragraphs,
and links into the repository are made absolute, since the notes live outside it.
"""

import re
import sys
from pathlib import Path

REPO = "https://github.com/nyx-12689/pyx"

DOWNLOAD = """\
Downloads for macOS 13 or later:

- **Apple Silicon** (M1 and later): the `aarch64` disk image
- **Intel**: the `x64` disk image
- **Either**: the `universal` disk image works on both, at about twice the size

Pyx isn't signed with a paid Apple Developer certificate, so macOS will block it the first time. \
Open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**.

Pyx needs ffmpeg and ImageMagick; if they're missing, it offers to install them with Homebrew."""


def section(changelog: str, version: str) -> str:
    """The text under `## <version>`, up to the next version heading."""
    match = re.search(rf"^## {re.escape(version)}\s*$(.*?)(?=^## |\Z)", changelog, re.M | re.S)
    if not match:
        sys.exit(f"CHANGELOG.md has no '## {version}' section; add one before releasing.")
    # Drop the divider that separates it from the next release.
    return re.sub(r"\n-{3,}\s*$", "", match.group(1).strip()).strip()


def unwrap(markdown: str) -> str:
    """Joins wrapped lines, keeping headings, list items (nested too) and blank lines as they are."""
    out: list[str] = []
    for line in markdown.split("\n"):
        starts_block = line == "" or line.lstrip().startswith(("#", "- ", "* ", "|", "```", "*Released"))
        if out and not starts_block and out[-1] and not out[-1].startswith("#"):
            out[-1] += " " + line.strip()
        else:
            out.append(line)
    return "\n".join(out)


def absolute_links(markdown: str) -> str:
    """Points relative links (docs/brand/README.md) at the repository on GitHub."""
    return re.sub(r"\]\((?!https?://|#)([^)]+)\)", lambda m: f"]({REPO}/blob/main/{m.group(1)})", markdown)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    version = sys.argv[1].removeprefix("v")
    changelog = Path(__file__).resolve().parents[2].joinpath("CHANGELOG.md").read_text()
    print(f"## What's new\n\n{absolute_links(unwrap(section(changelog, version)))}\n")
    print(f"Full history in [CHANGELOG.md]({REPO}/blob/main/CHANGELOG.md).\n")
    print(f"## Download\n\n{DOWNLOAD}")


if __name__ == "__main__":
    main()
