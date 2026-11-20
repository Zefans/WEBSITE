import React, { useRef, useEffect } from 'react';
import { generateHeatmapGrid } from '../utils/idw';
import { valueToColor } from '../utils/colorScale';

export default function HeatmapLayer({
  dataPoints,
  width,
  height,
  resolution = 2,
  opacity = 0.6,
  canvasWidth,
  canvasHeight,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataPoints || dataPoints.length === 0) return;

    const ctx = canvas.getContext('2d');
    const cw = canvasWidth || canvas.width;
    const ch = canvasHeight || canvas.height;

    canvas.width = cw;
    canvas.height = ch;

    // Generate the heatmap grid in building coords
    const grid = generateHeatmapGrid(dataPoints, width, height, resolution);

    // Scale factors
    const scaleX = cw / width;
    const scaleY = ch / height;
    const pixelRes = resolution;

    // Draw each grid cell
    const imageData = ctx.createImageData(cw, ch);
    const data = imageData.data;

    for (let gy = 0; gy < grid.length; gy++) {
      for (let gx = 0; gx < grid[gy].length; gx++) {
        const value = grid[gy][gx];
        const colorStr = valueToColor(value);
        // Parse rgba
        const match = colorStr.match(
          /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
        );
        if (!match) continue;

        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

        // Map grid position to canvas pixels
        const startPx = Math.floor(gx * pixelRes * scaleX);
        const startPy = Math.floor(gy * pixelRes * scaleY);
        const endPx = Math.floor((gx * pixelRes + pixelRes) * scaleX);
        const endPy = Math.floor((gy * pixelRes + pixelRes) * scaleY);

        for (let py = startPy; py < endPy && py < ch; py++) {
          for (let px = startPx; px < endPx && px < cw; px++) {
            const idx = (py * cw + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = Math.round(a * opacity * 255);
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [dataPoints, width, height, resolution, opacity, canvasWidth, canvasHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth || 900}
      height={canvasHeight || 300}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
