import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router'
import { RiverView } from './views/river-view'
import { WaterfallLayout } from './views/waterfall-view'
import type { ImageData } from './views/buildRows'
import { GridLayout } from './views/grid-view'
import { itemVariants } from './views/variants'
import { Image as Img } from './ui/image'

// const sampleImages: ImageData[] = mockImages(85);

// function getImageSize(
//   url: string
// ): Promise<{ width: number; height: number; alt: string }> {
//   return new Promise((resolve, reject) => {
//     const img = new Image()
//     img.onload = () => {
//       console.log(img.naturalWidth, img.naturalHeight)
//       resolve({
//         width: img.naturalWidth > 1024 ? 1024 : img.naturalWidth,
//         height: img.naturalHeight > 1024 ? 1024 : img.naturalHeight,
//         alt: img.alt,
//       })
//     }
//     img.onerror = reject
//     img.src = url
//   })
// }

export const Gallery = ({ images }: { images: ImageData[] }) => {
  const [searchParams] = useSearchParams()
  const layoutType = searchParams.get('layout') ?? 'grid'

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {layoutType === 'waterfall' ? (
        <WaterfallLayout images={images!} />
      ) : layoutType === 'river' ? (
        <RiverView images={images!} />
      ) : (
        <GridLayout>
          {images.map((item) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              initial="hidden"
              animate="show"
              className="w-full h-full aspect-4/3 overflow-hidden"
            >
              <motion.img
                data-prefetch="true"
                layoutId={item.id}
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes={item.sizes}
                srcSet={item.srcSet}
                className="rounded-md object-cover w-full h-full grayscale hover:grayscale-0 transition-all duration-300"
                decoding="async"
                loading="lazy"
              />
            </motion.div>
          ))}
        </GridLayout>
      )}
    </AnimatePresence>
  )
}
