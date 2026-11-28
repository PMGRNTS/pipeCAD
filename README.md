# Klamp Studio

A Tinkercad-style 3D designer for **Kee Klamp®-style pipe structures** (tables, shelving, workbenches, railings, canopies, frames). It is built for iPhone and iPad and runs as a static site on GitHub Pages.

## Features

- **Touch 3D editor.** One finger orbits, two fingers pan and pinch to zoom. Buttons jump to Top, Front and Side views.
- **Shapes library.** Table, shelving, workbench, railing, box frame, canopy, flat frame and post, each with editable dimensions.
- **Draw pipes with arrows.** Tap an arrow to add a pipe of the preset length, or drag it to any length (it snaps to the grid). The new end stays selected, so you can keep drawing.
- **Automatic fitting selection** from how many pipes meet at a joint and at what angles:

  | Joint | Fitting |
  |---|---|
  | 2 pipes at 90° | **15** 90° Elbow |
  | 3-way corner | **20** Side Outlet Elbow |
  | Pipe passing through + 1 branch | **10** Single Socket Tee (or **25** Three Socket Tee on request) |
  | Pipe through + 2 branches at 90° | **21** 90° Side Outlet Tee |
  | Pipe through + 2 opposite branches | **26** Two Socket Cross |
  | Pipe through + 3 branches | **35** Three Socket Cross |
  | Pipe through + 4 branches | **40** Four Socket Cross |
  | End on floor | **61** Flange (or **84** plug / open) |
  | Break in a straight run | **14** Straight Coupling |
  | Tee or elbow within ±11° of square | **86** Angle Tee / **87** Angle Elbow / **89** Two Socket Angle Cross |
  | Branch at 45° / 30°–60° to a through pipe | **12** 45° Single Socket Tee / **29** 30°–60° Single Socket Tee |
  | Two pipe ends at 125°–178° | **55** Obtuse Angle Elbow |
  | Angled pipe on the floor | **C58** Swivel Flange |
  | Any other angle | **C50** Single Swivel Socket (swivel joints are shown in brass) |

- **Rotation and angles.**
  - **Whole structure:** select a joint and choose **Move & rotate**. Drag the three rings to spin or tip the structure (it snaps to 15° by default; change this in Settings). You can also use the 90° and step buttons or type an exact angle. Choose whether it pivots on that joint or on the structure's center, and use **Drop to floor** after tipping it over.
  - **One pipe:** tap a pipe and drag the rings at its pivot joint to swing it. Everything hanging off that pipe swings with it, and the orange ring spins it around its own axis. You can also type an exact **Tilt** (from vertical) and **Heading**. **Square up** snaps it back to the nearest right angle. If the pipe is part of a closed loop, only its far end moves and the pipes joined there stretch to follow.
  - **Braces at any angle:** select a joint, tap **Connect to…**, then tap another joint or a spot on a pipe.
  - Drawing arrows line up with the pipes already at a joint, so you keep building square on a rotated structure.
- **Editing.** Type a pipe length (`36`, `36-1/2"`, `3' 6"`, `900mm`) or drag the stretch arrows; the rest of the structure stays square. You can also move or duplicate whole structures, add joints on existing pipes, choose which pipe passes through a cross, and undo or redo.
- **Parts list.** It shows fitting counts with part numbers (for example `21-7`), estimated cut lengths, and how many stock lengths to buy (it packs the cuts onto sticks). You can share it as CSV or copy it as text.
- **Designs are saved on the device** automatically, with a gallery. You can share or open `.klamp.json` design files, save a PNG picture, or export an STL.
- **Export for Godot.** **⋯ → Export for Godot (.glb)** writes a game-ready model: metres, Y up, one mesh with named materials, and its origin at the point it hangs from (above the balance point, or a joint you pick). It also contains the estimated weight, centre of mass, sling points and collision shapes. The [`godot/`](godot/README.md) folder has a Godot 4 script library that turns that file into a rigid body on a physics rope, and runs it along ceiling rails on trolleys, plus a demo facility.
- **Inches or millimetres**, with Kee Klamp sizes 4–9 (½" to 2" pipe).
- **Installable and offline.** Add it to the Home Screen and it works without a connection after the first load.

## Deploy to GitHub Pages

1. Create a new GitHub repository (for example `klamp-studio`).
2. Upload everything in this folder to the root of the repo: `index.html`, `manifest.webmanifest`, `sw.js`, `js/`, `icons/`.
3. In the repo go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-user>.github.io/klamp-studio/`.
5. On your iPhone, open that link in Safari, tap **Share → Add to Home Screen**, and launch it from the icon to use it full screen.

The `godot/` folder isn't needed on the website, so you can leave it out of the upload.

There is no build step. All paths are relative, so the app works from a project subfolder. three.js is loaded from the jsDelivr CDN and cached by the service worker for offline use.

**Updating:** when you change files, bump `CACHE` in `sw.js` (for example `klamp-studio-v3`) so installed copies pick up the new version.

## Notes

- Cut lengths are estimates. Half the pipe OD is deducted for each end that sits in a socket, and about 6 mm at a flange. Check against your actual fittings before cutting. You can turn the deduction off in Settings to get center-to-center lengths.
- For angled joints the app suggests the closest Kee Klamp angle or swivel fitting. Swivel sockets usually clamp a short distance from the joint, so check those joints with your supplier. Offset crossovers (Type 45) aren't modelled.
- Requires iOS / iPadOS 16.4 or later (or any current desktop browser).

Klamp Studio is an independent tool and is not affiliated with Kee Safety. Kee Klamp® is a registered trademark of Kee Safety Ltd.
