"""
Crops the real, tall "Parts Catalog, new category" screenshot down to
just its own, real, relevant bottom portion (where the "+ New
category..." form actually is) — the same, real, established
approach already, directly, proven earlier in this project's own
history. Run once per real language, after
capture-manual-screenshots.spec.ts produces the real, full-page
version.
"""
import sys
from PIL import Image

lang_suffix = sys.argv[1] if len(sys.argv) > 1 else ""
img_dir = f"manual-images{lang_suffix}"

im = Image.open(f"{img_dir}/m_items_new_category_full.png")
w, h = im.size
cropped = im.crop((0, h - 500, w, h))
cropped.save(f"{img_dir}/m_parts_cropped.png")
print(f"Cropped {img_dir}/m_items_new_category_full.png ({w}x{h}) -> m_parts_cropped.png ({cropped.size[0]}x{cropped.size[1]})")
