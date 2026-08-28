# Hidden Room

Practical techniques for making spaces feel wrong, larger on the inside, or physically impossible without confusing the player too early.

## Core Patterns

### 1. Occlusion-Gated Room Swap
- Hide a room transition behind a door frame, stair turn, elevator, vent, or narrow corridor.
- When the camera is fully occluded, swap the destination layout to a different space than the exterior implies.
- Best for: hidden rooms, impossible basements, bigger-on-the-inside buildings.

### 2. Portal Windows
- Render a different space inside a window, mirror, TV, or doorway than what exists behind it in world space.
- Keep the portal plane stable and believable from normal angles.
- Best for: seeing a room that should not fit, fake outdoors, ghost spaces.

### 3. Looping Corridor
- Teleport the player or the corridor modules once they cross a seam that looks identical on both sides.
- Small prop shifts, lighting changes, or sound changes can sell that the loop is progressing.
- Best for: dread, repetition, impossible hallways.

### 4. Offset Interior Shell
- Build the real interior far away from the exterior shell and connect them with controlled view lines.
- The player thinks they are in the same building, but the interior is physically elsewhere in the map.
- Best for: houses, diners, sheds, back rooms.

### 5. Staircase Height Cheat
- Let a staircase rise or fall farther than the exterior volume allows.
- Hide the mismatch with ceilings, landings, turns, darkness, or camera-constrained movement.
- Best for: second floors, hidden attics, deep basements.

## Perception Tricks

### 6. Repeat With Drift
- Reuse the same geometry chunk, but change one or two details each pass: wallpaper, stains, props, missing doors, text, sound.
- The player notices change without immediately seeing the mechanism.

### 7. Forced Perspective
- Scale architecture or props across a corridor so distance reads incorrectly.
- Works especially well with long halls, windows, and door frames.

### 8. Selective Visibility
- Show or hide meshes based on player position, facing direction, or floor level.
- Use this to reveal an upstairs only when inside, or a figure only from outdoors.

### 9. Audio Before Geometry
- Use sound to imply a nearby room before the space is physically possible.
- Jukebox hum, footsteps above, ventilation, or voices make the impossible layout feel intentional.

### 10. Soft Contradictions
- Let the player notice impossible clues before the big reveal.
- Examples: too many windows outside, stairs that rise too long, a room tone mismatch, a wall that should back onto open air.

## Implementation Tactics

### Trigger Zones
- Use simple AABBs or doorway volumes for transitions.
- Fire swaps only when the player cannot see the seam directly.

### Camera Control
- The cleaner the camera constraint, the easier the illusion.
- Tight stairwells, door frames, and hall corners are the safest places to cheat.

### Lighting Separation
- Give each impossible space its own light color, fog density, and exposure.
- This helps identical geometry read as a different place.

### Texture Anchors
- Reuse one or two familiar textures across impossible spaces so they still feel connected to the same building.
- Then break continuity with one wrong texture or object.

### Collision First
- Keep collision dead simple even if visuals are doing something tricky.
- Non-Euclidean ideas break fastest when collision and visuals disagree.

## Good Starting Recipes

### Hidden Room Behind a Normal Wall
1. Put the secret room elsewhere in the map.
2. Place a fake wall panel or closet door in the visible room.
3. When the camera passes through the tight opening, fade or hard-cut to the remote interior.
4. Prevent exterior lines of sight back to the original space.

### Bigger-On-The-Inside Building
1. Keep the exterior shell small.
2. Move the actual interior to a remote location.
3. Use a short vestibule, stair turn, or dark entry corridor as the seam.
4. Never allow a clear cross-check between exterior windows and interior walls.

### Endless Hall That Slowly Changes
1. Build one corridor module.
2. Duplicate it logically, not visually, by teleporting the player back to the start seam.
3. Increment a loop counter and change props, decals, lights, or text each cycle.

## Failure Modes
- Visible seams during teleport or room swap.
- Windows that expose the true exterior layout.
- Shadows or reflections that reveal the remote room trick.
- Overusing impossible tricks so the player stops trusting the space entirely.
- Making navigation so confusing that the scene feels broken instead of eerie.

## Best Fit For This Project
- Remote interior shells for spaces that do not fit the exterior.
- Stair height cheats for upstairs diner or house spaces.
- Selective visibility for interior-only floors and outside-only figures.
- Looping side corridors with slow prop drift.
- Portal-like windows only when the player cannot inspect them too closely.
