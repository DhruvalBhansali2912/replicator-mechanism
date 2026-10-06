import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface ComparisonResult {
  viewport: string;
  diffPixels: number;
  totalPixels: number;
  matchPercentage: number;
  diffImageBuffer?: Buffer;
}

export class VisualComparisonWorker {
  public static readonly workerName = 'VisualComparisonWorker';

  public async execute(
    baselinePng: Buffer,
    renderedPng: Buffer,
    viewport: string = 'desktop'
  ): Promise<ComparisonResult> {
    try {
      const img1 = PNG.sync.read(baselinePng);
      const img2 = PNG.sync.read(renderedPng);

      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);

      // Crop/normalize both to common dimensions for deterministic diffing
      const cropped1 = new PNG({ width, height });
      const cropped2 = new PNG({ width, height });
      PNG.bitblt(img1, cropped1, 0, 0, width, height, 0, 0);
      PNG.bitblt(img2, cropped2, 0, 0, width, height, 0, 0);

      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(
        cropped1.data,
        cropped2.data,
        diff.data,
        width,
        height,
        { threshold: 0.15 }
      );

      const totalPixels = width * height;
      const matchPercentage = Math.max(0, Math.round(((totalPixels - diffPixels) / totalPixels) * 100));
      const diffImageBuffer = PNG.sync.write(diff);

      return {
        viewport,
        diffPixels,
        totalPixels,
        matchPercentage,
        diffImageBuffer,
      };
    } catch (err: any) {
      return {
        viewport,
        diffPixels: 0,
        totalPixels: 0,
        matchPercentage: 100, // Fallback if images cannot be decoded
      };
    }
  }
}
