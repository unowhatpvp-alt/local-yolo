"""Optional test-only PIL reference. No Python is needed by the Web App.

Reproduce official Ultralytics v8.4.100 classify_transforms square path:
https://github.com/ultralytics/ultralytics/blob/v8.4.100/ultralytics/data/augment.py
PIL RGB -> bilinear Resize(shorter edge224) -> CenterCrop224 -> /255 NCHW.
DEFAULT_MEAN=(0,0,0), DEFAULT_STD=(1,1,1); no additional normalization.
Requires Pillow. Run from the repository root, then run
node scripts/diagnose-classification.mjs.
"""
from array import array
from pathlib import Path
import sys
from PIL import Image

root = Path("tests/fixtures/yolo26")
for index in range(10):
    image = Image.open(root / f"classification-val-{index}.jpg").convert("RGB")
    width, height = image.size
    output_width = 224 if width < height else int(224 * width / height)
    output_height = int(224 * height / width) if width < height else 224
    image = image.resize((output_width, output_height), Image.Resampling.BILINEAR)
    left, top = round((output_width - 224) / 2), round((output_height - 224) / 2)
    image = image.crop((left, top, left + 224, top + 224))
    pixels = list(image.getdata())
    tensor = array("f", (pixel[channel] / 255 for channel in range(3) for pixel in pixels))
    if sys.byteorder != "little":
        tensor.byteswap()
    with (root / f"classification-ref224-{index}.f32").open("wb") as output:
        tensor.tofile(output)
print("Wrote 10 independent PIL float32 RGB/NCHW reference tensors.")
