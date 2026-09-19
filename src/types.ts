export type SectionArchetype =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'card-grid'
  | 'carousel'
  | 'pricing'
  | 'testimonials'
  | 'cta'
  | 'stats'
  | 'faq'
  | 'contact'
  | 'gallery'
  | 'footer'
  | 'content';

export interface SectionMetadata {
  id: string; // e.g. "s1", "s2"
  name: string; // e.g. "s1-navbar", "s2-hero"
  archetype: SectionArchetype;
  confidence: number; // 0 to 1
  matchedReasons: string[];
  selector: string;
  tagName: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  screenshotPath?: string;
  elementCount: number;
}

export interface ExtractedSection {
  meta: SectionMetadata;
  rawHtml: string;
  cleanedHtml: string;
  purgedCss: string;
  minifiedCss: string;
  scopedJs: string;
  classMapping: Record<string, string>;
  idMapping: Record<string, string>;
  screenshotBuffer?: Buffer;
}

export interface ExtractionOptions {
  url: string;
  htmlSnapshot?: string;
  clientStylesheets?: string[];
  renameClasses?: boolean;
  purgeCss?: boolean;
  deminify?: boolean;
  localizeAssets?: boolean;
  rewriteLinks?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
  mobile?: boolean;
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface VisualQAResult {
  fidelityScore: number; // 0 to 100
  passed: boolean; // >= 80%
  viewportScores: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
  menuInteractivity: {
    desktopHoverPassed: boolean;
    mobileTogglePassed: boolean;
  };
  structuralChecks: {
    noWhiteOutSections: boolean;
    carouselsResponsive: boolean;
    fallbacksVisible: boolean;
  };
  diffImageUrls?: {
    desktop?: string;
    tablet?: string;
    mobile?: string;
  };
  attempts: number;
}

export type JobStatusType = 'queued' | 'crawling' | 'classifying' | 'transforming' | 'optimizing' | 'packaging' | 'validating' | 'completed' | 'failed';

export interface JobState {
  id: string;
  url: string;
  options: ExtractionOptions;
  status: JobStatusType;
  progress: number; // 0 to 100
  currentStep: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  apiKey?: string;
  fullPageScreenshot?: string;
  sections: SectionMetadata[];
  visualQA?: VisualQAResult;
  stats?: {
    originalHtmlBytes: number;
    transformedHtmlBytes: number;
    originalCssBytes: number;
    purgedCssBytes: number;
    minifiedCssBytes: number;
    assetCount: number;
    sectionCount: number;
  };
  packageZipPath?: string;
}

export interface MasterArchetypeRule {
  archetype: SectionArchetype;
  title: string;
  description: string;
  requiredTags?: string[];
  preferredTags?: string[];
  keywords: string[];
  classPatterns: RegExp[];
  idPatterns: RegExp[];
  rolePatterns?: string[];
  positionBias?: 'top' | 'middle' | 'bottom';
  minHeight?: number;
  maxHeight?: number;
  interactiveHints?: string[];
}
