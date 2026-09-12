import cairosvg

NAVY = "#1C2530"
GOLD = "#C9A227"
CREAM = "#F4F1EA"
RED = "#E1483B"

SHIELD_PATH = (
    "M512,170 "
    "C420,170 340,205 300,255 "
    "L300,560 "
    "C300,700 380,800 512,880 "
    "C644,800 724,700 724,560 "
    "L724,255 "
    "C684,205 604,170 512,170 Z"
)

# Material-style phone handset icon, originally in a 24x24 box, scaled and
# translated so it sits centered inside the shield above.
PHONE_PATH_RAW = (
    "M6.62,10.79c1.44,2.83,3.76,5.14,6.59,6.59l2.2-2.2c0.27-0.27,0.67-0.36,1.02-0.24"
    "c1.12,0.37,2.33,0.57,3.57,0.57c0.55,0,1,0.45,1,1V20c0,0.55-0.45,1-1,1"
    "c-9.39,0-17-7.61-17-17c0-0.55,0.45-1,1-1h3.5c0.55,0,1,0.45,1,1"
    "c0,1.25,0.2,2.45,0.57,3.57c0.11,0.35,0.03,0.74-0.25,1.02L6.62,10.79z"
)
PHONE_TRANSFORM = "translate(351,352) scale(14)"

# The mark (shield + phone + rec dot), pre-shrunk and centered so it sits
# safely inside the ~66% "safe zone" that Android's adaptive-icon masks
# (circle / squircle / rounded-square / teardrop) will show.
MARK = f"""
<g transform="translate(512,512) scale(0.82) translate(-512,-512)">
  <path d="{SHIELD_PATH}" fill="{GOLD}"/>
  <path d="{PHONE_PATH_RAW}" fill="{CREAM}" transform="{PHONE_TRANSFORM}"/>
  <circle cx="700" cy="255" r="58" fill="{RED}" stroke="{NAVY}" stroke-width="10"/>
</g>
"""

def svg(background_rect: bool) -> str:
    bg = f'<rect x="0" y="0" width="1024" height="1024" fill="{NAVY}"/>' if background_rect else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  {bg}
  {MARK}
</svg>"""

# 1. Main app icon — opaque navy background, full bleed square (Play Store
#    style: no pre-rounded corners, no transparency; the OS applies its own mask).
cairosvg.svg2png(bytestring=svg(True).encode(), write_to="/home/claude/CallVault/assets/icon.png",
                  output_width=1024, output_height=1024, background_color="#1C2530")

# 2. Adaptive icon foreground — transparent background, mark only, used with
#    a separate solid backgroundColor set in app.json.
cairosvg.svg2png(bytestring=svg(False).encode(), write_to="/home/claude/CallVault/assets/adaptive-icon.png",
                  output_width=1024, output_height=1024)

# 3. Splash mark — same transparent foreground, composited by Expo onto the
#    splash backgroundColor already set in app.json.
cairosvg.svg2png(bytestring=svg(False).encode(), write_to="/home/claude/CallVault/assets/splash-icon.png",
                  output_width=1024, output_height=1024)

print("icons written")
