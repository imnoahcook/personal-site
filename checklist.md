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
