# MyHouse.wad — Non-Euclidean Geometry Reference

## Overview
MyHouse.wad is a 2023 Doom II mod by Veddge that uses GZDoom engine tricks to create impossible architecture inspired by House of Leaves. The house starts normal but gradually distorts — rooms expand, corridors loop, and spaces appear that shouldn't exist.

## Core Techniques

### 1. Lineportals (Seamless Teleportation)
- **What**: GZDoom lineportals create invisible seams between disconnected map areas
- **Effect**: Walking through a doorway silently teleports you to a completely different part of the map, but the transition is seamless — no loading, no visual break
- **Our equivalent**: Teleport triggers (already implemented for infinite staircase)

### 2. Off-Map Room Stacking
- **What**: Rooms that appear to be adjacent or stacked are actually built in separate areas of the map far apart
- **Effect**: A room that's "upstairs" is actually located thousands of units away. You're teleported there when you use stairs
- **Our equivalent**: Could move SecondFloor to a remote position and teleport there

### 3. Silent Teleporters
- **What**: Hidden teleport lines on the floor that move the player without any visual indication
- **Effect**: You walk through a hallway and end up somewhere impossible, but you never noticed the transition
- **Our equivalent**: Trigger zones with matching visual environments at source/destination

### 4. Dynamic Room Reconfiguration
- **What**: ZScript tracks player actions and modifies the map — doors appear/disappear, rooms change layout between visits
- **Effect**: Returning to a room finds it different than before. Subtle at first, then increasingly wrong
- **Our equivalent**: Could use state tracking + conditional rendering

### 5. Polyobjects
- **What**: Moving geometry within the Doom engine (normally static)
- **Effect**: Walls that slide, rooms that physically resize while you're in them
- **Our equivalent**: Animated mesh positions/scales via useFrame

### 6. Automap Manipulation
- **What**: The minimap is deliberately broken — either blacked out or shows fake layouts
- **Effect**: Player can't use the map to understand the space, increasing disorientation
- **Our equivalent**: N/A (no minimap), but could add a misleading one

## Notable Spaces & How They Work

### The House Itself
- Starts as a faithful recreation of a real suburban house
- Gradually becomes larger on the inside than the outside (classic House of Leaves)
- Uses lineportals at doorways to seamlessly connect to larger versions of rooms

### The Bathhouse (Looping Corridors)
- A series of consecutive left turns that loop back on themselves
- Similar to Antichamber's impossible geometry
- Implemented with lineportals at each turn, connecting to rotated copies of the corridor

### The Void / Infinite Spaces
- Massive dark rooms that shouldn't fit inside the house
- Built off-map and connected via silent teleporters
- The player has no spatial reference, creating the feeling of infinite space

### Dynamic Changes
- Rooms reconfigure between visits (tracked via ZScript)
- Monsters respawn, new doors emerge, passages shift
- Creates the feeling that the house is alive and changing

## Applying to Our Diner

### Already Implemented
- [x] Infinite staircase (teleport loop)
- [x] Impossible corridor (47 units through a 16-unit building)
- [x] Ghost figure (visible from outside, vanishes inside)
- [x] Invisible second floor (appears only when you're on it)
- [x] Second floor windows showing real outside (no exterior windows exist)

### Could Add
- [ ] **Looping corridor**: The impossible corridor could loop back to its entrance (Antichamber-style turns)
- [ ] **Room reconfiguration**: Track visit count, change diner layout on return (moved furniture, new doors, missing objects)
- [ ] **Silent teleporter in a doorway**: A booth that leads to a massive void room when entered from a specific angle
- [ ] **Growing house**: Each time you enter the diner, it's slightly larger inside
- [ ] **Wrong reflections**: A mirror that shows the room differently than it actually is
- [ ] **The basement**: The infinite staircase could eventually lead to a vast dark space (the house's "growths")

## Key Resources
- [MyHouse.wad Wikipedia](https://en.wikipedia.org/wiki/MyHouse.wad)
- [Grokipedia MyHouse.wad](https://grokipedia.com/page/myhousewad)
- [Doom Wiki - My House](https://doomwiki.org/wiki/My_House)
- [House of Leaves](https://en.wikipedia.org/wiki/House_of_Leaves) — the novel that inspired both MyHouse.wad and our diner
- Engine: GZDoom 4.8.1+ with UDMF format, hardware renderer
