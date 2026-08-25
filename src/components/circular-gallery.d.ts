import type { ReactElement } from "react";

export interface CircularGalleryItem {
  image: string;
  text: string;
}

export interface CircularGalleryProps {
  items?: CircularGalleryItem[];
  bend?: number;
  textColor?: string;
  borderRadius?: number;
  font?: string;
  fontUrl?: string;
  scrollSpeed?: number;
  scrollEase?: number;
  /**
   * Amount added to the scroll target each frame, in the same units as an
   * item's width. 0 disables the drift. Ignored under prefers-reduced-motion.
   */
  autoScrollSpeed?: number;
}

declare function CircularGallery(props: CircularGalleryProps): ReactElement;
export default CircularGallery;
