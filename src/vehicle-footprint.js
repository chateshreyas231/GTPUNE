// Long vehicles occupy several circles rather than a single point at their centre.
export function vehicleSamples(mesh, x, z, yaw = 0, radius = 1.4) {
  const length = Number(mesh?.userData?.length) || 4.7;
  const offsets =
    length > 6 ? [0, length / 2 - radius, -length / 2 + radius] : [0];
  return offsets.map((offset) => ({
    x: x - Math.sin(yaw) * offset,
    z: z - Math.cos(yaw) * offset,
    radius,
  }));
}
