# Third-party sample assets

Files in this directory tree that are NOT first-party Kukui content:

## `hotspot-3d/box.glb`, `virtual-tour/box.glb`

Khronos Group glTF Box sample (1.6 KB).

- **Source:** https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box
- **Author:** Khronos Group
- **License:** CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

Bundled locally rather than fetched from raw.githubusercontent.com so
the starter renders inside LMS networks that block external CDNs and
under strict Content Security Policies (`connect-src 'self'`). Each
SCORM zip ships a copy alongside the activity HTML.

Attribution is also surfaced in the activity footer at runtime via
the `model.attribution` block on the starter config.

## `interactive-video/samples/basic.json` — "Big Buck Bunny" video + poster

Referenced (not bundled) via an external URL on Google's public
`gtv-videos-bucket`.

- **Source:** https://peach.blender.org/ (hosted at
  `commondatastorage.googleapis.com/gtv-videos-bucket/sample/`)
- **Author:** Blender Foundation
- **License:** CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

External-hosted, so it needs network access and will not load under a
strict LMS Content Security Policy or offline. It is only a demo
fixture; authors swap `video.src` for author-hosted media in production.

## `hotspot-2d/samples/images/kukui-nut.jpg` — kukui (candlenut) tree photo

Photograph of a kukui (candlenut) tree branch with developing fruit.

- **Source:** https://commons.wikimedia.org/wiki/File:Kukui_(Candlenut).jpg
- **Author:** Philipola (Wikimedia Commons)
- **License:** CC0 1.0 / public domain (https://creativecommons.org/publicdomain/zero/1.0/)

Bundled locally so the sample renders offline and under strict LMS
Content Security Policies. CC0 requires no attribution, but the
photographer is credited on the rendered activity via the
`image.attribution` block on the sample config.

## `image-comparison-slider/samples/images/candlenuts-whole.jpg`, `candlenuts-marketed.jpg` — candlenut (kukui) kernel photos

Two photographs of candlenut (kukui / Aleurites moluccana) kernels: loose
shelled kernels, and kernels bundled in bags for sale at a Southeast Asian
market.

- **Source (whole):** https://commons.wikimedia.org/wiki/File:Candlenuts_(Aleurites_moluccana).jpg
- **Source (marketed):** https://commons.wikimedia.org/wiki/File:Candlenuts_(Aleurites_moluccana)_marketed.jpg
- **Author:** David E Mead (Wikimedia Commons)
- **License:** CC0 1.0 / public domain (https://creativecommons.org/publicdomain/zero/1.0/)

Bundled locally so the sample renders offline and under strict LMS
Content Security Policies. CC0 requires no attribution, but the
photographer is credited on the rendered activity via the top-level
`attribution` block on the sample config.

## First-party placeholder SVG diagrams

The placeholder images under `*/samples/images/*.svg` (cell, neuron,
wrist radiographs, anatomy schematic, cardiac-cycle slides) are original
Kukui artwork, authored in-house and released under the repository's MIT
license. No third-party attribution required. They replaced external
`placehold.co` references so samples render offline and under strict LMS
CSPs. Authors swap them for real clinical art in production.

If we add more sample assets later, list them here with the same
source / author / license fields.
