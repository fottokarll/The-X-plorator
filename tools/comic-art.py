#!/usr/bin/env python3
"""
Builds the Exodus prologue art from the two approved comic composites
(private handoff, NOT in this repository) into small WebP panels plus a
readable layout module for the game:

  src/assets/comic/wide/panel_0N.webp   desktop page panels (from the wide composite)
  src/assets/comic/tall/panel_0N.webp   phone panels (from the portrait composite)
  src/story/art-layout.js               polygons, balloon text boxes, sizes

The composites carry baked English text. This tool removes it so that every
word shown in the game comes from src/story/strings.en.js:
  - caption plates (cream boxes, top-left of each panel) are painted out
    (boundary diffusion from the surrounding art, plus a mirrored texture);
  - speech balloons keep their drawn shape (outline and tail) but their
    interior is cleared to the balloon white; the game writes the words in.
Each balloon also gets its tail tip (found here) and its free room: a
rectangle of plain background around it, measured by eye on the panels, with
no people in it. A line that does not fit the drawn balloon gets a larger
balloon of the game's own, only ever inside that room.
Coordinates were measured on the composites (gutter probes, see
docs/EXODUS_PROLOGUE.md). Re-run after replacing the art:

  python3 -I tools/comic-art.py <handoff>/references

Requires Pillow with WebP support. Pure Python otherwise (slow but simple).
"""
import json
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUALITY = 80

# Art polygons (art edges, inside the white gutters) and seeds, in composite pixels;
# balloon rooms [x, y, w, h] and tail tips (where the detection below picks a
# corner; None: no tail) in panel pixels (the panel crop's own coordinates).
WIDE = {
    'file': 'exodus_comic_desktop_approved.png',
    'page': [24, 54, 1648, 898],
    'panels': [
        {'poly': [[24, 54], [849, 54], [799, 296], [24, 281]], 'plate': [36, 74], 'balloon': [236, 190], 'room': [198, 36, 332, 124]},
        {'poly': [[865, 54], [1648, 54], [1648, 282], [815, 296]], 'plate': [878, 76], 'balloon': [1066, 172], 'room': [175, 38, 197, 104]},
        {'poly': [[24, 294], [847, 311], [882, 510], [24, 486]], 'plate': [36, 318], 'balloon': [165, 372], 'room': [128, 28, 200, 86]},
        {'poly': [[863, 310], [1648, 296], [1648, 536], [897, 511]], 'plate': [890, 326], 'balloon': None},
        {'poly': [[24, 500], [767, 521], [713, 722], [24, 701]], 'plate': [36, 521], 'balloon': [334, 590], 'room': [296, 18, 140, 98], 'tail': [365, 121]},
        {'poly': [[783, 520], [1648, 549], [1648, 712], [730, 722]], 'plate': [804, 543], 'balloon': None},
        {'poly': [[24, 715], [725, 737], [1648, 724], [1648, 898], [24, 898]], 'plate': [36, 746], 'balloon': [1352, 812], 'room': [1200, 30, 290, 145]},
    ],
}
TALL = {
    'file': 'exodus_comic_phone_approved.png',
    'page': [24, 48, 926, 1608],
    'panels': [
        {'poly': [[24, 48], [926, 48], [926, 255], [470, 291], [24, 272]], 'plate': [30, 72], 'balloon': [210, 170], 'room': [172, 38, 340, 112]},
        {'poly': [[24, 286], [470, 304], [926, 269], [926, 508], [470, 515], [24, 495]], 'plate': [30, 314], 'balloon': [262, 420], 'room': [228, 40, 327, 132]},
        {'poly': [[24, 508], [470, 529], [926, 523], [926, 742], [24, 688]], 'plate': [30, 540], 'balloon': [175, 600], 'room': [140, 20, 190, 100]},
        {'poly': [[24, 701], [926, 756], [926, 985], [24, 921]], 'plate': [30, 728], 'balloon': None},
        {'poly': [[24, 936], [926, 999], [926, 1150], [470, 1181], [24, 1153]], 'plate': [30, 963], 'balloon': [352, 1040], 'room': [312, 28, 175, 92], 'tail': [394, 137]},
        {'poly': [[24, 1166], [470, 1195], [926, 1164], [926, 1379], [24, 1339]], 'plate': [30, 1196], 'balloon': None},
        {'poly': [[24, 1352], [926, 1392], [926, 1608], [24, 1608]], 'plate': [30, 1383], 'balloon': [748, 1440], 'room': [600, 28, 295, 112], 'tail': None},
    ],
}


def inside(poly, x, y):
    """Even-odd point-in-polygon test."""
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def is_cream(p):
    r, g, b = p
    return r > 200 and g > 180 and b > 120 and r - b > 18 and r >= g >= b - 6


def is_white(p):
    return min(p) > 205 and max(p) - min(p) < 40


def find_seed(px, w, h, x, y, pred, radius=16):
    for d in range(radius + 1):
        for dy in range(-d, d + 1):
            for dx in range(-d, d + 1):
                if max(abs(dx), abs(dy)) != d:
                    continue
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h and pred(px[X, Y]):
                    return X, Y
    raise RuntimeError(f'no seed near {x},{y}')


def flood(px, w, h, seed, pred, limit=260):
    sx, sy = seed
    seen = {seed}
    stack = [seed]
    while stack:
        x, y = stack.pop()
        for X, Y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (X, Y) in seen or not (0 <= X < w and 0 <= Y < h):
                continue
            if abs(X - sx) > limit or abs(Y - sy) > limit:
                continue
            if pred(px[X, Y]):
                seen.add((X, Y))
                stack.append((X, Y))
    return seen


def holes(region):
    """Pixels enclosed by `region` (not reachable from its bounding box edge)."""
    xs = [p[0] for p in region]
    ys = [p[1] for p in region]
    x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1
    outside = set()
    stack = [(x, y) for x in range(x0, x1 + 1) for y in (y0, y1)] + [(x, y) for y in range(y0, y1 + 1) for x in (x0, x1)]
    for p in stack:
        outside.add(p)
    while stack:
        x, y = stack.pop()
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if q in outside or q in region:
                continue
            if not (x0 <= q[0] <= x1 and y0 <= q[1] <= y1):
                continue
            outside.add(q)
            stack.append(q)
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if (x, y) not in region and (x, y) not in outside}


def dilate(mask, r):
    out = set(mask)
    for x, y in mask:
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + dy * dy <= r * r:
                    out.add((x + dx, y + dy))
    return out


def inpaint(img, mask, poly):
    """Fills `mask` from the art around it: Jacobi diffusion from the valid
    boundary (inside the panel polygon, outside the mask), blended with a
    softened mirror of the art just right of the hole for texture (plates sit
    in the top-left corner, so the scene continues to their right)."""
    px = img.load()
    w, h = img.size
    mask = {p for p in mask if 0 <= p[0] < w and 0 <= p[1] < h}
    valid = lambda x, y: 0 <= x < w and 0 <= y < h and (x, y) not in mask and inside(poly, x + 0.5, y + 0.5)
    val = {}
    # Initialise with the mean of the valid ring.
    ring = [px[x, y] for (mx, my) in mask for x, y in ((mx + 1, my), (mx - 1, my), (mx, my + 1), (mx, my - 1)) if valid(x, y)]
    mean = tuple(sum(c[i] for c in ring) / max(1, len(ring)) for i in range(3))
    for p in mask:
        val[p] = list(mean)
    order = sorted(mask)
    for _ in range(260):
        for (x, y) in order:
            acc = [0.0, 0.0, 0.0]
            n = 0
            for X, Y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (X, Y) in val:
                    c = val[(X, Y)]
                elif valid(X, Y):
                    c = px[X, Y]
                else:
                    continue
                acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]
                n += 1
            if n:
                val[(x, y)] = [acc[0] / n, acc[1] / n, acc[2] / n]
    xs = [p[0] for p in mask]
    right = max(xs) + 2
    blur = img.filter(ImageFilter.BoxBlur(2))
    bpx = blur.load()
    for (x, y), c in val.items():
        mx = right + (right - x)
        if mx < w and valid(mx, y):
            t = bpx[mx, y]
            c = [0.55 * c[0] + 0.45 * t[0], 0.55 * c[1] + 0.45 * t[1], 0.55 * c[2] + 0.45 * t[2]]
        px[x, y] = tuple(int(round(v)) for v in c)


def process(spec, refs, out_dir, tag):
    src = Image.open(os.path.join(refs, spec['file'])).convert('RGB')
    W, H = src.size
    spx = src.load()
    page = spec['page']
    entries = []
    os.makedirs(out_dir, exist_ok=True)
    for i, p in enumerate(spec['panels']):
        poly = p['poly']
        xs = [q[0] for q in poly]
        ys = [q[1] for q in poly]
        box = [min(xs), min(ys), max(xs), max(ys)]
        crop = src.crop((box[0], box[1], box[2], box[3]))
        cpx = crop.load()
        cw, ch = crop.size
        local = [[q[0] - box[0], q[1] - box[1]] for q in poly]
        # 1. Balloon: keep the shape, clear the words.
        balloon = None
        if p['balloon']:
            bx, by = find_seed(spx, W, H, p['balloon'][0], p['balloon'][1], is_white)
            region = flood(spx, W, H, (bx, by), is_white, limit=180)
            text = holes(region)
            fill = sorted(spx[q] for q in region)
            white = fill[int(len(fill) * 0.9)]
            for (x, y) in region | text:
                X, Y = x - box[0], y - box[1]
                if 0 <= X < cw and 0 <= Y < ch:
                    cpx[X, Y] = white
            tx = [q[0] for q in text]
            ty = [q[1] for q in text]
            rx = [q[0] for q in region]
            ry = [q[1] for q in region]
            # The tail tip: the balloon pixel farthest from the middle of its words.
            mx, my = (min(tx) + max(tx)) / 2, (min(ty) + max(ty)) / 2
            tip = max(region, key=lambda q: (q[0] - mx) ** 2 + ((q[1] - my) * 1.6) ** 2)
            balloon = {
                # Where the baked words were (the game writes its text here)...
                'text': [min(tx) - box[0] - 6, min(ty) - box[1] - 5, max(tx) - min(tx) + 12, max(ty) - min(ty) + 10],
                # ...and the whole cleared balloon, tail included.
                'shape': [min(rx) - box[0], min(ry) - box[1], max(rx) - min(rx) + 1, max(ry) - min(ry) + 1],
                'fill': '#%02x%02x%02x' % white,
                'tail': p['tail'] if 'tail' in p else [tip[0] - box[0], tip[1] - box[1]],
                # Free background around it: the only place a bigger balloon may go.
                'room': p['room'],
            }
        # 2. Caption plate (after the balloon, so no word can be copied into its fill): cream component + its text holes + the dark border.
        sx, sy = find_seed(spx, W, H, p['plate'][0], p['plate'][1], is_cream)
        plate = flood(spx, W, H, (sx, sy), is_cream, limit=420)
        plate |= holes(plate)
        plate_box = [min(q[0] for q in plate), min(q[1] for q in plate), max(q[0] for q in plate), max(q[1] for q in plate)]
        # The plate is a rectangle: take its whole box, then its border.
        rect = {(x, y) for x in range(plate_box[0], plate_box[2] + 1) for y in range(plate_box[1], plate_box[3] + 1)}
        mask = {(x - box[0], y - box[1]) for (x, y) in dilate(rect, 4)}
        inpaint(crop, mask, local)
        name = f'panel_{i + 1:02d}.webp'
        path = os.path.join(out_dir, name)
        crop.save(path, 'WEBP', quality=QUALITY, method=6)
        size = os.path.getsize(path)
        entries.append({
            'file': f'assets/comic/{tag}/{name}', 'bytes': size, 'width': cw, 'height': ch,
            'at': [box[0] - page[0], box[1] - page[1]], 'poly': local, 'balloon': balloon,
            'plate': [plate_box[0] - box[0], plate_box[1] - box[1], plate_box[2] - plate_box[0] + 1, plate_box[3] - plate_box[1] + 1],
        })
        print(f'{tag} {name}: {cw}x{ch} {size / 1024:.1f} KB  plate {entries[-1]["plate"]}  balloon {balloon and balloon["text"]}')
    return {'page': [page[2] - page[0], page[3] - page[1]], 'panels': entries}


def js(value, indent=2, level=0):
    """Readable JS literal (short arrays on one line)."""
    pad = ' ' * (indent * (level + 1))
    end = ' ' * (indent * level)
    if isinstance(value, dict):
        items = [f'{pad}{k}: {js(v, indent, level + 1)},' for k, v in value.items()]
        return '{\n' + '\n'.join(items) + f'\n{end}}}'
    if isinstance(value, list):
        flat = json.dumps(value)
        if len(flat) < 90 and not any(isinstance(v, dict) for v in value):
            return flat.replace(',', ', ')
        return '[\n' + '\n'.join(f'{pad}{js(v, indent, level + 1)},' for v in value) + f'\n{end}]'
    if value is None:
        return 'null'
    return json.dumps(value)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    refs = sys.argv[1]
    wide = process(WIDE, refs, os.path.join(ROOT, 'src', 'assets', 'comic', 'wide'), 'wide')
    tall = process(TALL, refs, os.path.join(ROOT, 'src', 'assets', 'comic', 'tall'), 'tall')
    body = js({'wide': wide, 'tall': tall})
    header = (
        '/**\n'
        ' * Exodus prologue art layout, written by tools/comic-art.py from the two\n'
        ' * approved composites (edit the tool and re-run it, not this file).\n'
        ' * Per art set: page size, and per panel its WebP file and byte size, its\n'
        ' * pixel size, its offset on the page, its outline polygon (local pixels),\n'
        ' * the cleared balloon (where the game writes the words, the shape, the fill,\n'
        ' * the tail tip and the free room a bigger balloon may use: no people there)\n'
        ' * and where the removed caption plate was. The words are in strings.en.js.\n'
        ' */\n'
    )
    with open(os.path.join(ROOT, 'src', 'story', 'art-layout.js'), 'w') as f:
        f.write(header + f'export const ART = {body};\n')
    total = sum(p['bytes'] for p in wide['panels']), sum(p['bytes'] for p in tall['panels'])
    print(f'total wide {total[0] / 1024:.1f} KB, tall {total[1] / 1024:.1f} KB')


if __name__ == '__main__':
    main()
