"use strict";
/* Pinhole camera for the form-tracking benchmark.

   Placement is described the way a person sets a phone on a tripod:
     yawDeg    azimuth around the archer, 0 = perpendicular to the shooting line on the chest side
               ("true side view"); positive = moved back behind the shooting line (away from the
               target), which is where a camera can safely stand. 180 = the archer's back side.
     pitchDeg  camera elevation seen from the aim point (positive = camera above, looking down).
     rollDeg   rotation about the optical axis (phone not level). Positive = image content turns
               counterclockwise on screen (a phone turned clockwise).
     torsoFrac subject size: true torso length (mid-shoulder to mid-hip) as a fraction of the
               frame height when the archer stands in the stance. Sets the camera distance.
     width, height  frame size in pixels (portrait = height > width).
     hfovLongDeg    horizontal field of view across the long side (default 69 deg, a 26 mm-equivalent
                    phone main camera; assumption).
     offsetX, offsetY  where the aim point lands in the frame, as a fraction of width/height from
                    the centre (positive = right / down).

   Image coordinates are pixels with x to the right and y down; normalized landmarks are
   x / width and y / height, exactly like MediaPipe. */

const { V, DEG } = require("./lib");

function makeCamera(cfg, body, handedness) {
  const c = cfg || {};
  const W = c.width || 1280;
  const Hp = c.height || 720;
  const H = body.H;
  const longSide = Math.max(W, Hp);
  const f = longSide / 2 / Math.tan(((c.hfovLongDeg || 69) * DEG) / 2);
  const torsoPx = (c.torsoFrac || 0.22) * Hp;
  const dist = (f * body.torso) / torsoPx;
  const sign = handedness === "left" ? -1 : 1; // the left-handed world is mirrored in x
  /* aim point: between the body and the extended bow arm, a little above the hips */
  const aim = [sign * (c.aimShiftX == null ? 0.1 : c.aimShiftX) * H, 0, 0.56 * H];
  const yaw = (c.yawDeg || 0) * DEG;
  const pitch = (c.pitchDeg == null ? 3 : c.pitchDeg) * DEG;
  const horiz = dist * Math.cos(pitch);
  const C = [
    aim[0] - sign * horiz * Math.sin(yaw),
    aim[1] - horiz * Math.cos(yaw),
    aim[2] + dist * Math.sin(pitch),
  ];
  const fwd = V.norm(V.sub(aim, C));
  let right = V.norm(V.cross(fwd, [0, 0, 1]));
  let up = V.cross(right, fwd);
  const roll = (c.rollDeg || 0) * DEG;
  if (roll) {
    /* rotate the camera's right/up about the optical axis; the image content turns the other way */
    const r2 = V.comb([right, Math.cos(roll)], [up, -Math.sin(roll)]);
    const u2 = V.comb([right, Math.sin(roll)], [up, Math.cos(roll)]);
    right = r2;
    up = u2;
  }
  const cx = W / 2 - (c.offsetX || 0) * W;
  const cy = Hp / 2 - (c.offsetY || 0) * Hp;
  /* world point -> {u, v (pixels), depth (m along the optical axis)} */
  const project = (P) => {
    const d = V.sub(P, C);
    const zc = V.dot(d, fwd);
    const z = zc > 1e-3 ? zc : 1e-3;
    return { u: cx + (f * V.dot(d, right)) / z, v: cy - (f * V.dot(d, up)) / z, depth: zc };
  };
  return {
    width: W,
    height: Hp,
    f,
    distance: dist,
    position: C,
    forward: fwd,
    right,
    up,
    aim,
    torsoPxNominal: torsoPx,
    project,
    /* MediaPipe-style normalized landmark (no noise): x,y in [0,1] of the frame, z relative to the
       hip-midpoint depth on roughly the same scale as x. */
    normalize(p, hipDepth) {
      return {
        x: p.u / W,
        y: p.v / Hp,
        z: ((p.depth - hipDepth) * f) / Math.max(1e-3, hipDepth) / W,
      };
    },
    describe() {
      return {
        width: W,
        height: Hp,
        orientation: Hp > W ? "portrait" : W > Hp ? "landscape" : "square",
        focalPx: +f.toFixed(1),
        distanceM: +dist.toFixed(2),
        heightM: +C[2].toFixed(2),
        yawDeg: c.yawDeg || 0,
        pitchDeg: c.pitchDeg == null ? 3 : c.pitchDeg,
        rollDeg: c.rollDeg || 0,
        torsoFrac: c.torsoFrac || 0.22,
      };
    },
  };
}

/* Projected pose without noise: square-pixel image points (u, v), depth, normalized landmarks. */
function projectPose(cam, pts) {
  const proj = pts.map((p) => cam.project(p));
  const hipDepth = (proj[23].depth + proj[24].depth) / 2;
  return { proj, hipDepth, lms: proj.map((p) => cam.normalize(p, hipDepth)) };
}

module.exports = { makeCamera, projectPose };
