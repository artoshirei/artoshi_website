import { ShapeGeometry, Vector2 } from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export const FIGMA_BLOB_VIEWBOX = {
  width: 735,
  height: 593,
} as const;

export const FIGMA_BLOB_PATH =
  "M637.412 280.904C694.333 301.975 735 357.736 735 423.205C735 506.769 668.75 574.511 587.027 574.511C545.858 574.511 508.613 557.318 481.793 529.569C457.492 567.753 415.378 593 367.502 593C319.622 593 277.513 567.753 253.208 529.569C226.387 557.318 189.142 574.511 147.973 574.511C66.2492 574.511 0 506.769 0 423.205C0 355.712 43.2206 298.536 102.91 279.045C61.6485 252.199 34.2723 205.024 34.2723 151.306C34.2723 67.7416 100.522 0 182.245 0C218.311 0 251.365 13.1917 277.04 35.1244C301.102 13.2763 332.782 0 367.502 0C404.173 0 437.456 14.8113 461.951 38.8968C488.177 14.7166 522.908 0 561.001 0C642.724 0 708.974 67.7416 708.974 151.306C708.974 206.28 680.301 254.406 637.412 280.904Z";

const FIGMA_BLOB_SVG = `<svg viewBox="0 0 ${FIGMA_BLOB_VIEWBOX.width} ${FIGMA_BLOB_VIEWBOX.height}" xmlns="http://www.w3.org/2000/svg"><path d="${FIGMA_BLOB_PATH}" /></svg>`;

const loader = new SVGLoader();
const parsed = loader.parse(FIGMA_BLOB_SVG);
const shapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path));

if (shapes.length === 0) {
  throw new Error("Failed to parse the Figma blob shape.");
}

function polygonArea(points: Vector2[]) {
  let area = 0;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area * 0.5;
}

function getBounds(points: Vector2[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

const baseShape = [...shapes].sort((a, b) => {
  const aArea = Math.abs(polygonArea(a.getPoints(256)));
  const bArea = Math.abs(polygonArea(b.getPoints(256)));
  return bArea - aArea;
})[0];

const rawBoundaryPoints = baseShape.getPoints(1024);
const bounds = getBounds(rawBoundaryPoints);
const centerX = (bounds.minX + bounds.maxX) * 0.5;
const centerY = (bounds.minY + bounds.maxY) * 0.5;
const maxDimension = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

export const FIGMA_BLOB_NORMALIZED_SIZE = {
  width: (bounds.maxX - bounds.minX) / maxDimension,
  height: (bounds.maxY - bounds.minY) / maxDimension,
} as const;

const normalizedBoundary = rawBoundaryPoints.map(
  (point) =>
    new Vector2(
      (centerX - point.x) / maxDimension,
      (centerY - point.y) / maxDimension,
    ),
);

if (!normalizedBoundary[0].equals(normalizedBoundary[normalizedBoundary.length - 1])) {
  normalizedBoundary.push(normalizedBoundary[0].clone());
}

function cross(a: Vector2, b: Vector2) {
  return a.x * b.y - a.y * b.x;
}

function sampleBoundaryAtAngle(theta: number) {
  const direction = new Vector2(Math.cos(theta), Math.sin(theta));
  let farthestDistance = 0;
  let hitPoint: Vector2 | null = null;

  for (let i = 0; i < normalizedBoundary.length - 1; i += 1) {
    const start = normalizedBoundary[i];
    const end = normalizedBoundary[i + 1];
    const segment = end.clone().sub(start);
    const denominator = cross(direction, segment);

    if (Math.abs(denominator) < 1e-8) {
      continue;
    }

    const rayDistance = cross(start, segment) / denominator;
    const segmentDistance = cross(start, direction) / denominator;

    if (rayDistance < 0 || segmentDistance < 0 || segmentDistance > 1) {
      continue;
    }

    if (rayDistance > farthestDistance) {
      farthestDistance = rayDistance;
      hitPoint = direction.clone().multiplyScalar(rayDistance);
    }
  }

  if (hitPoint) {
    return hitPoint;
  }

  return new Vector2(0, 0);
}

const boundarySampleCache = new Map<number, Vector2[]>();

export function getBlobBoundarySamples(sampleCount: number) {
  const cached = boundarySampleCache.get(sampleCount);
  if (cached) {
    return cached;
  }

  const samples = Array.from({ length: sampleCount }, (_, index) =>
    sampleBoundaryAtAngle((index / sampleCount) * Math.PI * 2),
  );

  boundarySampleCache.set(sampleCount, samples);
  return samples;
}

export function createBlobGeometry(curveSegments = 256) {
  const geometry = new ShapeGeometry(baseShape, curveSegments);
  geometry.translate(-centerX, -centerY, 0);
  geometry.scale(-1 / maxDimension, -1 / maxDimension, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
