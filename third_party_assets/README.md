# Third-Party Asset Intake

Downloaded on 2026-03-18 for the inspection page refresh.

I avoided copyrighted ripped PS1 game assets. This folder contains legally downloadable packs with clear source pages.

## Best Immediate Candidates

- `extracted/retro_urban_kit/Models/GLB format/`
  - Best for actual PS1/PSX-adjacent environment pieces.
  - Source: https://opengameart.org/content/retro-urban-kit
  - License: CC0
  - Notes: Retro early-3D style, low-res textures, direct `.glb` files.

- `extracted/blocky_characters/Models/GLB format/`
  - Best for immediately replacing the current diner NPCs.
  - Source: https://opengameart.org/content/3d-rigged-characters
  - License: CC0
  - Notes: Not true PS1-authentic, but ready-to-use `.glb` files and much safer than runtime simplification.

- `extracted/food_kit/Models/GLB format/`
  - Best for diner props: burgers, fries, cups, soda, donuts, coffee, bottles, trays.
  - Source: https://opengameart.org/content/food-kit
  - License: CC0
  - Notes: Direct `.glb` files. This is the easiest pack to drop into the current page.

## Actual PSX-ish Packs

- `extracted/psx_misc_props/psx_1/`
  - Source: https://opengameart.org/content/miscellaneous-low-poly-objects
  - License: CC0
  - Notes: Small PSX-tagged prop pack. Includes `radio`, `rotary_phone`, and `traffic_cone`.
  - Format: FBX only in this download, so it likely needs conversion to `.glb` for your current pipeline.

- `extracted/psx_medieval_soldier/medieval-soldier/`
  - Source: https://opengameart.org/content/low-poly-psx-style-medieval-soldier-rigged-animated
  - License: CC0
  - Notes: Actual PSX-style character, but not diner-themed.
  - Format: `.blend` plus textures, so it needs Blender export before use here.

## Extra Filler

- `extracted/house_interior_pack/Ultimate House Interior Pack - June 2020/`
  - Source: https://opengameart.org/content/lowpoly-house-interior-pack
  - License: CC0
  - Notes: Good fallback furniture/interior pack if you want to hand-build a better diner layout.
  - Format: FBX / OBJ / Blend, no GLB in this pack.

## Recommended Next Swap-In Order

1. Replace food props from `extracted/food_kit/Models/GLB format/`.
2. Replace characters from `extracted/blocky_characters/Models/GLB format/`.
3. Pull selective environment pieces from `extracted/retro_urban_kit/Models/GLB format/`.
4. Convert the PSX-tagged FBX/Blend assets only if you still want stronger PS1 authenticity after the easy wins.
