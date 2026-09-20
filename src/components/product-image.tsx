import Image from "next/image";
import { productImageSrc } from "@/lib/images";

export function ProductImage({
  image,
  name,
  className = "",
  /**
   * Inset around the photo. It has to be the caller's choice because it does
   * not scale with the box: 16px reads as deliberate whitespace on a 300px
   * card and swallows a 40px thumbnail whole, leaving 8px of product. Pass a
   * smaller value for anything thumbnail-sized.
   */
  padding = "p-4",
  sizes,
  priority,
}: {
  image: string;
  name: string;
  className?: string;
  padding?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-zinc-50 dark:bg-zinc-900 ${className}`}>
      <Image
        src={productImageSrc(image)}
        alt={name}
        fill
        sizes={sizes ?? "(min-width: 1024px) 25vw, 50vw"}
        priority={priority}
        className={`object-contain ${padding}`}
      />
    </div>
  );
}
