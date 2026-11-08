# Template placement

All 31 production templates share the **Dream Diwali** layout, so they share one measured default
placement (each template can still be overridden individually in **Branch Templates**).

## How it was measured

The inner edge of the gold arch frame was traced **from pixels**: headless Chromium scanned `36.jpg`
(at half resolution) row by row from the centre outwards for “gold” pixels (`r>170, r−b>90, g−b>35`).

| Feature | Normalized position (of poster) |
|---|---|
| Arch apex (inner edge) | y ≈ 0.2445 |
| First shoulder step | y ≈ 0.333 |
| Second shoulder step | y ≈ 0.392 |
| Straight sides | x ≈ 0.0722 … 0.9272 from y ≈ 0.43 |
| Lamp tiles begin | y ≈ 0.651 |

## Default region (`photoPlacement`)

```json
{
  "x": 0.078, "y": 0.2485, "width": 0.844, "height": 0.4065,
  "rotation": 0, "shape": "path", "featherBottom": 0.14, "cropMode": "cover",
  "path": "M0,1 L0,0.45 … L0.5,0 … L1,0.45 L1,1 Z"
}
```

* Region is inset ~20 px (0.006) from the gold line so the frame stays visible.
* `path` is the traced arch, expressed in region-unit coordinates (0–1 inside the region box).
* `featherBottom: 0.14`: the bottom 14 % of the photo fades into the poster's cream background
  above the lamp tiles, so no artwork, text, logo or address is ever covered.
* Mode **`flat`**: template drawn first, customer photo drawn on top, clipped strictly to the path.

## Compositing modes supported by the engine

| Mode | Use when | Render order |
|---|---|---|
| `flat` | Flattened JPEG (all current templates) | template → photo (clipped) → optional foreground overlay |
| `transparent-window` | PNG/WEBP with a transparent opening | photo → template on top |
| `layered` | Separate background + foreground art | background → photo → foreground |

The engine never cuts arbitrary holes in a template. A new flat template that cannot take a photo
cleanly stays `needs-manual-placement` / unverified until an administrator saves a placement.

## Editing placements

**Branch Templates** (`/templates`):
- Drag the blue box to move the region and drag the handles to resize it. You can also type exact x/y/w/h values.
- Choose a shape (arch path, rectangle, rounded rectangle, ellipse) and set the bottom fade and crop mode.
- Preview with the current session photo, a built-in sample, or an uploaded test photo.
- **Save** stores an override in IndexedDB (`templateOverrides`).
- **Export JSON / Import JSON** moves placements between devices. Imports are validated and unknown ids are rejected.
- **Reset** returns the template to the audited manifest values.
