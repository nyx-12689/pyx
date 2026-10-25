"""Builds the Pyx logo kit SVGs into kit/."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from marks import P_BODY, P_STAR, P_SMALL_BODY, P_SMALL_STAR, svg, wordmark

INK, PAPER = "#171717", "#FFFFFF"
BLUE, BLUE_DARK = "#2A78D6", "#3987E5"  # the app's --viz-1 in light and dark mode
NIGHT_TOP, NIGHT_BOTTOM = "#2B2E35", "#0E0F12"

out = os.path.join(os.path.dirname(__file__), "svg")
os.makedirs(out, exist_ok=True)


def write(name, text):
    with open(os.path.join(out, name), "w") as fh:
        fh.write(text)


def symbol(body, star, small=False):
    b, s = (P_SMALL_BODY, P_SMALL_STAR) if small else (P_BODY, P_STAR)
    return f'<path fill="{body}" fill-rule="evenodd" d="{b}"/><path fill="{star}" d="{s}"/>'


WM_PATHS, WM_W = wordmark()


def word(fill, x, y, scale):
    paths = "".join(f'<path d="{p}"/>' for p in WM_PATHS)
    return f'<g fill="{fill}" fill-rule="evenodd" transform="translate({x:.2f} {y:.2f}) scale({scale})">{paths}</g>'


# Horizontal lockup "Pyx": the symbol is the capital P, followed by the wordmark's "yx"
# on the same baseline, matching the P's stroke weight.
YX_SCALE = 32 / 30
YX_X0 = 122  # where the y starts in wordmark units (after the p)
YX_LEFT = 198 + 12  # just after the P's bowl
H_BOX = (46, 16, 198 + 12 + (WM_W - YX_X0) * YX_SCALE - 46 + 20, 270)  # x, y, w, h


def horizontal(body, star, word_fill):
    paths = "".join(f'<path d="{p}"/>' for p in WM_PATHS[1:])
    x = YX_LEFT - YX_X0 * YX_SCALE
    y = 220 - 112 * YX_SCALE
    return (f'{symbol(body, star)}<g fill="{word_fill}" fill-rule="evenodd" '
            f'transform="translate({x:.2f} {y:.2f}) scale({YX_SCALE:.4f})">{paths}</g>')


# Stacked lockup: symbol above, wordmark centred below.
S_SCALE = 0.44
S_W, S_H = 256, 322


def stacked(body, star, word_fill):
    ww = WM_W * S_SCALE
    return f'{symbol(body, star)}{word(word_fill, (256 - ww) / 2, 258, S_SCALE)}'


schemes = {
    "": (INK, BLUE, INK),               # full colour, for light backgrounds
    "-reversed": (PAPER, BLUE_DARK, PAPER),  # full colour, for dark backgrounds
    "-black": (INK, INK, INK),
    "-white": (PAPER, PAPER, PAPER),
}
for suffix, (body, star, wf) in schemes.items():
    write(f"pyx-symbol{suffix}.svg", svg("0 0 256 256", symbol(body, star)))
    write(f"pyx-symbol-small{suffix}.svg", svg("0 0 256 256", symbol(body, star, small=True)))
    write(f"pyx-horizontal{suffix}.svg", svg("{} {} {:.2f} {}".format(*H_BOX), horizontal(body, star, wf)))
    write(f"pyx-stacked{suffix}.svg", svg(f"0 20 {S_W} {S_H}", stacked(body, star, wf)))
    write(f"pyx-wordmark{suffix}.svg", svg(f"-4 -4 {WM_W + 8:.2f} 168", word(wf, 0, 0, 1)))


def app_icon(small=False):
    """macOS app icon on Apple's 1024 grid: an 824 tile with a soft shadow, the mark in white."""
    k = 460 / 184  # the mark (184 tall on its 256 grid) fills 460 of the tile
    tx, ty = 512 - 132 * k, 500 - 128 * k
    return svg("0 0 1024 1024", f"""
<defs>
  <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{NIGHT_TOP}"/><stop offset="1" stop-color="{NIGHT_BOTTOM}"/>
  </linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>
  <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".28"/>
  </filter>
</defs>
<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#tile)" filter="url(#shadow)"/>
<rect x="101.5" y="101.5" width="821" height="821" rx="183.5" fill="none" stroke="url(#rim)" stroke-width="3"/>
<g transform="translate({tx:.2f} {ty:.2f}) scale({k:.4f})">{symbol("#F5F5F4", BLUE_DARK, small)}</g>""")


write("pyx-app-icon.svg", app_icon())
write("pyx-app-icon-small.svg", app_icon(small=True))  # for the 16 and 32 px icon sizes

# Web/favicon: the small cut, tight on its square, colours that hold on light and dark tabs.
write("pyx-favicon.svg", svg("0 0 256 256", f"""<style>.b{{fill:{INK}}}.s{{fill:{BLUE}}}
@media (prefers-color-scheme: dark){{.b{{fill:{PAPER}}}.s{{fill:{BLUE_DARK}}}}}</style>
<path class="b" fill-rule="evenodd" d="{P_SMALL_BODY}"/><path class="s" d="{P_SMALL_STAR}"/>"""))

print("horizontal", H_BOX, "stacked", S_W, S_H)
