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

If we add more sample assets later, list them here with the same
source / author / license fields.
