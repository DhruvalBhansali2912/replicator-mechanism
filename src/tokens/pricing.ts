export interface OperationPricingConfig {
  analyze_section: number;
  capture_viewport: number;
  visual_segmentation: number;
  reconstruction: number;
  visual_comparison: number;
  optimization_iteration: number;
  asset_analysis: number;
  [key: string]: number;
}

export const DEFAULT_PRICING: OperationPricingConfig = {
  analyze_section: 1,
  capture_viewport: 1,
  visual_segmentation: 2,
  reconstruction: 3,
  visual_comparison: 1,
  optimization_iteration: 1,
  asset_analysis: 1,
};

let currentPricing: OperationPricingConfig = { ...DEFAULT_PRICING };

export class PricingService {
  public static getPricing(): OperationPricingConfig {
    return { ...currentPricing };
  }

  public static updatePricing(newPricing: Partial<OperationPricingConfig>): OperationPricingConfig {
    for (const [op, cost] of Object.entries(newPricing)) {
      if (typeof cost === 'number' && cost >= 0) {
        currentPricing[op] = cost;
      }
    }
    return { ...currentPricing };
  }

  public static getCost(operation: string): number {
    return currentPricing[operation] ?? 1;
  }

  public static estimateReconstructionCost(options?: {
    viewportsCount?: number;
    sectionsCount?: number;
    optimizeIterations?: number;
  }): number {
    const viewports = options?.viewportsCount || 3; // desktop, tablet, mobile
    const sections = options?.sectionsCount || 4;
    const iterations = options?.optimizeIterations || 1;

    let total = 0;
    total += this.getCost('reconstruction');
    total += this.getCost('capture_viewport') * viewports;
    total += this.getCost('visual_segmentation');
    total += this.getCost('analyze_section') * sections;
    total += this.getCost('asset_analysis');
    total += this.getCost('visual_comparison') * viewports;
    total += this.getCost('optimization_iteration') * iterations;

    return Math.max(1, total);
  }
}
