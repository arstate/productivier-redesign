# SEO & Core Web Vitals — Productivier

## 1. Core Web Vitals Targets
- **Largest Contentful Paint (LCP)**: < 1.2s (SVG and text-based metrics render instantly).
- **Cumulative Layout Shift (CLS)**: 0.0 (Strict height reservations and container query sizing).
- **Interaction to Next Paint (INP)**: < 100ms (Lightweight client transitions powered by `motion/react`).

## 2. Metadata & Viewport
- Standard viewport configuration: `width=device-width, initial-scale=1.0`.
- Multi-device compatibility: Desktop (`1440x900`, `1280x800`) and Mobile (`375x812`, `360x800`).
