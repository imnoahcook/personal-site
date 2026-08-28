# Inspection Scene Checklist

## Models to Add
- [ ] Food/drink props on counter and tables (burger, coffee cup, etc.)
- [ ] Human characters visible OUTSIDE the diner windows (customers/passersby)
  - Should NOT be visible from inside the diner — only seen through windows from outside

## Non-Euclidean / Weird Geometry
- [ ] Diner is bigger on the inside than the outside
- [ ] Two-story diner — second floor has windows on the inside, but they don't exist on the outside
- [ ] Infinite staircase (done - behind STAFF ONLY door)
- [ ] Impossible corridor (done - off left wall)

## PS1 Aesthetic
- [ ] Vertex snapping — removed for now, causes floors to disappear at certain angles. Need to either exclude large flat surfaces or use a less aggressive resolution. Could lean into the glitchiness as a horror effect (floors vanishing intentionally in certain rooms?)
- [ ] Dithering / posterization (from romanliutikov article)
- [ ] **Textured models instead of flat-color** — PS1 look requires actual image textures on geometry, not flat colors. Need models with diffuse texture maps (Sketchfab, not Poly Pizza). Then apply nearest-neighbor filtering (NearestFilter) to make textures crunchy/pixelated. Current flat-color models look modern low-poly, not PS1.
- [ ] Lower render DPR (currently 0.75, could go to 0.5)
- [ ] Affine texture mapping (shader from romanliutikov article)

## Sources for Free Models (CC0)
- Poly Pizza: https://poly.pizza
  - Food & Drink: https://poly.pizza/explore/Food-and-Drink
  - Characters: https://poly.pizza/explore/People-and-Characters
  - Cup (Kenney, CC0): https://poly.pizza/m/aSF8ANEIsX
  - Burger (Quaternius, CC0): https://poly.pizza/m/Jb6JuSjNYy
  - Business Man (Quaternius, CC0): https://poly.pizza/m/JFrLIKqvCH
  - Suit (Quaternius, CC0): https://poly.pizza/m/sOUciDsoVV
  - Worker (Quaternius, CC0): https://poly.pizza/m/Yg2bQZO6Hj

## Non-Euclidean Playtest Issues
- [ ] Scale-change demo: changing scale feels abrupt; smooth or blend the transition so it does not snap visually. Gated from public routes for now.
- [ ] Scale-change demo: size changes appear to jump instead of changing gradually. Not sure yet what the best fix is, but track it explicitly. Gated from public routes for now.
- [ ] Floorplan house: textures look incorrect and overly tiled/noisy. See Image #1 from the playtest notes.
- [ ] Portal traversal: passing through portals has a brief jump/stutter instead of feeling continuous.
- [ ] Sloped tunnel portal: portal view does not render correctly. See Image #2 from the playtest notes.
- [ ] Sloped tunnel movement: player cannot walk up the slope outside the tunnel.
- [ ] Deployment note: do not deploy between changes unless explicitly requested.

## Worker Prompt
Please select one slice of this checklist and implement it. There will be other models working on other items in parallel. Ignore their work unless it directly affects your slice, do not revert or overwrite their changes, and keep your edits scoped. Implement and test your selected slice locally. The test plan must include opening the website in a headed Chrome dev browser and taking a screenshot that supports the new behavior or fix. Report which files you changed, what you tested, the screenshot path or artifact, and any remaining risks or follow-up work.
