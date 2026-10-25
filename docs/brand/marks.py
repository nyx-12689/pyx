"""Pyx mark geometry: the symbol, its small-size cut and the wordmark, as plain filled paths."""

def star(cx, cy, R, r):
    return (f"M{cx} {cy-R}Q{cx+r} {cy-r} {cx+R} {cy}Q{cx+r} {cy+r} {cx} {cy+R}"
            f"Q{cx-r} {cy+r} {cx-R} {cy}Q{cx-r} {cy-r} {cx} {cy-R}Z")

# Symbol on a 256 grid: stem and bowl 32 thick, bowl radii 46/14, corner radius 6.
P_BODY = ("M66 36H152A46 46 0 0 1 198 82V108A46 46 0 0 1 152 154H98V214A6 6 0 0 1 92 220H72"
          "A6 6 0 0 1 66 214V42A6 6 0 0 1 72 36Z"
          "M98 68H152A14 14 0 0 1 166 82V108A14 14 0 0 1 152 122H98Z")
P_STAR = star(132, 95, 18, 4.5)

# Small-size cut (16–32 px): heavier strokes, a larger counter, the star as a plain diamond.
P_SMALL_BODY = ("M54 26H150A54 54 0 0 1 204 80V110A54 54 0 0 1 150 164H96V222A8 8 0 0 1 88 230H62"
                "A8 8 0 0 1 54 222V34A8 8 0 0 1 62 26Z"
                "M96 66H148A16 16 0 0 1 164 82V108A16 16 0 0 1 148 124H96Z")
P_SMALL_STAR = "M130 75L150 95L130 115L110 95Z"


def wordmark(t=30):
    """Lowercase 'pyx' with x-height 112 (y 0..112) and descender to 160; returns (paths, width)."""
    import math
    d = t - 3                                # diagonals run a touch thinner so they look as heavy as the stems
    s = 0.5                                  # slope dx/dy of the y
    w = d / math.cos(math.atan(s))           # horizontal width of a diagonal stroke
    paths = []
    # p: the symbol's bowl in miniature, on a stem that drops to the descender
    ro, ri = 40, 10
    bw = 104
    paths.append(f"M0 4A4 4 0 0 1 4 0H{bw-ro}A{ro} {ro} 0 0 1 {bw} {ro}V{112-ro}A{ro} {ro} 0 0 1 {bw-ro} 112H{t}"
                 f"V156A4 4 0 0 1 {t-4} 160H4A4 4 0 0 1 0 156Z"
                 f"M{t} {t}H{bw-t-ri}A{ri} {ri} 0 0 1 {bw-t} {t+ri}V{112-t-ri}A{ri} {ri} 0 0 1 {bw-t-ri} {112-t}H{t}Z")
    # y: short left arm meets a long right arm at the baseline
    x0 = bw + 18
    cv = x0 + w/2 + 112*s                    # apex of the V, on the centre line
    paths.append(f"M{x0:.2f} 0H{x0+w:.2f}L{cv+w/2:.2f} 112H{cv-w/2:.2f}Z")
    paths.append(f"M{cv+112*s-w/2:.2f} 0H{cv+112*s+w/2:.2f}L{cv-48*s+w/2:.2f} 160H{cv-48*s-w/2:.2f}Z")
    yr = cv + 112*s + w/2
    # x: two crossing diagonals
    sx = 0.72                                # the x opens wider than the y
    wx = d / math.cos(math.atan(sx))
    a = yr + 12
    paths.append(f"M{a:.2f} 0H{a+wx:.2f}L{a+wx+112*sx:.2f} 112H{a+112*sx:.2f}Z")
    paths.append(f"M{a+112*sx:.2f} 0H{a+112*sx+wx:.2f}L{a+wx:.2f} 112H{a:.2f}Z")
    return paths, a + wx + 112*sx


def svg(viewbox, body, title="Pyx"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}"><title>{title}</title>{body}</svg>\n'
