import { RecordedInteraction } from '../types.js';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textMuted: string;
  border: string;
}

export interface TypographyTokens {
  fontFamily: string;
  headingFamily: string;
  baseFontSize: number; // e.g. 16
  lineHeight: number; // e.g. 1.5
  scale: {
    h1: number;
    h2: number;
    h3: number;
    body: number;
    small: number;
  };
}

export interface SpacingTokens {
  containerMaxWidth: number; // e.g. 1200
  sectionPaddingY: number; // e.g. 64
  gridGap: number; // e.g. 24
  borderRadius: number; // e.g. 8
  boxShadow: string;
}

export interface DesignTokens {
  colors: ColorPalette;
  typography: TypographyTokens;
  spacing: SpacingTokens;
}

export interface InteractiveHoverState {
  selector: string;
  targetRole: 'button' | 'link' | 'card' | 'menu-item' | 'icon';
  originalStyles: {
    backgroundColor?: string;
    color?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
  };
  hoverStyles: {
    backgroundColor?: string;
    color?: string;
    transform?: string;
    boxShadow?: string;
    borderColor?: string;
  };
  hasFlyoutMenu?: boolean;
}

export interface InteractiveClickState {
  triggerSelector: string;
  targetRole: 'dropdown' | 'mobile-drawer' | 'accordion' | 'tab' | 'modal';
  targetSelector?: string;
  toggledClass?: string;
  ariaExpanded?: boolean;
}

export interface AuthenticFilterChipSpec {
  containerSelector: string;
  itemWrapClass?: string;
  itemClass?: string;
  templateHtml?: string;
}

export interface InteractiveCapabilities {
  hoverStates: InteractiveHoverState[];
  clickStates: InteractiveClickState[];
  recordedTransitions?: RecordedInteraction[];
  filterChipSpec?: AuthenticFilterChipSpec;
}

export type SectionArchetype =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'tabs'
  | 'pricing'
  | 'testimonials'
  | 'faq'
  | 'stats'
  | 'cta'
  | 'footer'
  | 'generic-section';

export interface ActionButton {
  text: string;
  href: string;
  variant: 'primary' | 'secondary' | 'outline';
  isExternal?: boolean;
}

export interface NavDropdownItem {
  text: string;
  href: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface NavLinkItem {
  text: string;
  href: string;
  hasDropdown?: boolean;
  dropdownItems?: NavDropdownItem[];
}

export interface FeatureCardItem {
  title: string;
  description: string;
  iconSvg?: string;
  imageUrl?: string;
  link?: string;
}

export interface PricingPlanItem {
  name: string;
  price: string;
  billingPeriod?: string;
  description?: string;
  features: string[];
  isPopular?: boolean;
  buttonText: string;
  buttonHref: string;
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
  rating?: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface MediaItem {
  type: 'image' | 'picture' | 'video';
  src: string;
  poster?: string;
  alt?: string;
  sources?: { srcset?: string; src?: string; type?: string; media?: string }[];
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export interface ImageItem {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  sources?: { srcset: string; media?: string }[];
}

export interface CarouselDotItem {
  count: number;
  activeIndex: number;
}

export interface SectionAST {
  id: string;
  archetype: SectionArchetype;
  sourceSelector: string;
  title?: string;
  titleHtml?: string;
  subtitle?: string;
  subtitleLink?: string;
  stats?: StatItem[];
  media?: MediaItem[];
  brand?: { name: string; logoUrl?: string; logoSvg?: string; href: string };
  navLinks?: NavLinkItem[];
  navUtilityLinks?: { text: string; href: string }[];
  navActionIcons?: { name: string; iconSvg: string; href?: string; label?: string }[];
  actions?: ActionButton[];
  featureCards?: FeatureCardItem[];
  pricingPlans?: PricingPlanItem[];
  testimonials?: TestimonialItem[];
  faqs?: FAQItem[];
  rawText?: string;
  images?: ImageItem[];
  heroMedia?: {
    src: string;
    alt?: string;
    sources?: { srcset: string; media?: string }[];
    isPicture?: boolean;
  };
  carouselDots?: CarouselDotItem;
  theme?: 'light' | 'dark' | 'card';
  layout: 'hero-overlay' | 'card-split' | 'split-hero' | 'flex-row-between' | 'flex-column-center' | 'grid-2-col' | 'grid-3-col' | 'grid-4-col' | 'stacked';
  interactive: InteractiveCapabilities;
  tokens: DesignTokens;
  sourceUrl?: string;
  rawSectionHtml?: string;
  rawCssContext?: string;
  rawHtmlSnapshot?: string;
  rootCssVariables?: Record<string, string>;
}

export interface ScoringBreakdown {
  structuralScore: number; // 0 - 30 (Semantic tags, content preservation, container hierarchy)
  visualScore: number; // 0 - 40 (Pixel/layout alignment, typography scale, color harmony)
  interactiveScore: number; // 0 - 30 (Hover transitions, click toggles, drawer/accordion response)
  totalScore: number; // 0 - 100
  passed: boolean; // Must be >= 90
  failureReasons: string[];
}

export interface SynthesizedSectionResult {
  sectionId: string;
  archetype: SectionArchetype;
  html: string;
  css: string;
  js: string;
  scoring: ScoringBreakdown;
  designTokens: DesignTokens;
  interactiveFeatures: string[];
}
