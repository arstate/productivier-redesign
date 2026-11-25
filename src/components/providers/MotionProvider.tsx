"use client";

import React from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const loadMotionFeatures = () =>
  import("motion/react").then((mod) => mod.domMax);

/**
 * Loads full DOM + layout motion features asynchronously so initial
 * render/hydration stays lightweight while keeping spring & layoutId animations smooth.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
