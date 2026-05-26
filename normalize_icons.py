# normalize_icons.py
#
# Batch-normalize fair app WEBP icons:
# - preserves transparency
# - preserves dimensions
# - preserves filenames
# - preserves white foreground symbols
# - shifts orange wood backgrounds toward the TODAY/MIDWAY tone
# - slightly darkens perimeter/border
#
# REQUIREMENTS:
#   pip install pillow numpy
#
# USAGE:
#   python normalize_icons.py input_dir output_dir
#
# EXAMPLE:
#   python normalize_icons.py ./icons ./icons_fixed

import os
import sys
import numpy as np

from PIL import Image, ImageEnhance, ImageFilter

# -------------------------------------------------------
# REFERENCE COLOR TUNING
# -------------------------------------------------------
#
# These values were chosen to:
# - reduce orange saturation
# - shift toward medium brown
# - preserve wood texture
#
# You can tweak later if desired.
#

SATURATION_REDUCTION = 1.00
BRIGHTNESS_REDUCTION = 1.06
REDUCTION_RED = 0.94
REDUCTION_GREEN = 0.94
BOOST_BLUE = 1.07

EDGE_DARKEN_STRENGTH = 0.25

# -------------------------------------------------------
# HELPERS
# -------------------------------------------------------

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)


def is_white_pixel(r, g, b):
    """
    Preserve white foreground symbols.
    """
    return r > 190 and g > 190 and b > 190


def is_background_pixel(r, g, b):
    """
    Detect orange/brown wood background pixels.
    """
    return (
        r > 60 and
        g > 30 and
        b < r and
        r > b * 1.2
    )


def apply_color_normalization(img):
    """
    Shift orange wood tones toward medium brown.
    """

    arr = np.array(img).astype(np.float32)

    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    h, w = alpha.shape

    for y in range(h):
        for x in range(w):

            if alpha[y, x] == 0:
                continue

            r, g, b = rgb[y, x]

            # preserve white symbols
            if is_white_pixel(r, g, b):
                continue

            # modify only wood background
            if is_background_pixel(r, g, b):

                # reduce orange/red cast
                r *= REDUCTION_RED
                g *= REDUCTION_GREEN
                b *= BOOST_BLUE

                # slight darkening
                r *= BRIGHTNESS_REDUCTION
                g *= BRIGHTNESS_REDUCTION
                b *= BRIGHTNESS_REDUCTION

                rgb[y, x] = [
                    np.clip(r, 0, 255),
                    np.clip(g, 0, 255),
                    np.clip(b, 0, 255)
                ]

    out = np.dstack([rgb, alpha])

    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def apply_saturation_control(img):
    """
    Reduce oversaturated orange appearance.
    """
    converter = ImageEnhance.Color(img)
    return converter.enhance(SATURATION_REDUCTION)


def darken_edges(img):
    """
    Slightly darken perimeter/border.
    Preserves transparency.
    """

    arr = np.array(img).astype(np.float32)

    h, w, _ = arr.shape

    center_x = w / 2
    center_y = h / 2

    max_dist = np.sqrt(center_x**2 + center_y**2)

    for y in range(h):
        for x in range(w):

            alpha = arr[y, x, 3]

            if alpha == 0:
                continue

            dx = x - center_x
            dy = y - center_y

            dist = np.sqrt(dx*dx + dy*dy)

            vignette = dist / max_dist

            darken = 1.0 - (vignette * EDGE_DARKEN_STRENGTH)

            arr[y, x, 0] *= darken
            arr[y, x, 1] *= darken
            arr[y, x, 2] *= darken

    arr = np.clip(arr, 0, 255)

    return Image.fromarray(arr.astype(np.uint8), 'RGBA')


def process_icon(infile, outfile):

    img = Image.open(infile).convert("RGBA")

    # preserve exact dimensions
    original_size = img.size

    # normalize wood tone
    img = apply_color_normalization(img)

    # reduce oversaturation
    img = apply_saturation_control(img)

    # slight darker edge effect
    img = darken_edges(img)

    # optional tiny sharpen
    img = img.filter(ImageFilter.SHARPEN)

    # preserve exact dimensions
    img = img.resize(original_size)

    # save as WEBP with alpha preserved
    img.save(
        outfile,
        format="WEBP",
        lossless=True,
        quality=100,
        method=6
    )

    print(f"Processed: {os.path.basename(infile)}")


# -------------------------------------------------------
# MAIN
# -------------------------------------------------------

def main():

    if len(sys.argv) != 3:
        print("\nUsage:")
        print("  python normalize_icons.py input_dir output_dir\n")
        return

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]

    ensure_dir(output_dir)

    supported = (".webp", ".png")

    for filename in os.listdir(input_dir):

        if not filename.lower().endswith(supported):
            continue

        infile = os.path.join(input_dir, filename)
        outfile = os.path.join(output_dir, filename)

        try:
            process_icon(infile, outfile)

        except Exception as e:
            print(f"FAILED: {filename}")
            print(e)

    print("\nDone.")


if __name__ == "__main__":
    main()