import Image from "next/image";

export function ProductImage({
  image,
  name,
  className = "",
  sizes,
  priority,
}: {
  image: string;
  name: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-zinc-50 dark:bg-zinc-900 ${className}`}>
      <Image
        src={image}
        alt={name}
        fill
        sizes={sizes ?? "(min-width: 1024px) 25vw, 50vw"}
        priority={priority}
        className="object-contain p-4"
      />
    </div>
  );
}
