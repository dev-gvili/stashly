import { forwardRef, useId, useState, useEffect } from 'react'
import { cn } from '@/utils/styles'
import type { FitEnum } from 'sharp'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Skeleton } from './skeleton'
import { AnimatePresence, motion } from 'framer-motion'

const IMAGE_SRCSET_CONFIG = {
  sm: {
	media: '(max-width: 640px)', // Tailwind sm
	width: 320,
	height: 320,
	fit: 'cover',
  },
  md: {
	media: '(max-width: 768px)', // Tailwind md
	width: 640,
	height: 640,
	fit: 'cover',
  },
  lg: {
	media: '(max-width: 1024px)', // Tailwind lg
	width: 1024,
	height: 1024,
	fit: 'cover',
  },
  xl: {
	media: '(max-width: 1280px)', // Tailwind xl
	width: 1280,
	height: 1280,
	fit: 'cover',
  },
  '2xl': {
	media: '(min-width: 1536px)', // Tailwind 2xl
	width: 1536,
	height: 1536,
	fit: 'cover',
  },
} as const

const variants = {
	initial: {
		opacity: 1,
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	exit: {
		opacity: 0,
		transition: {
			duration: 0.3,
			ease: 'easeInOut',
		},
	},
} as const

export interface ImageProps extends React.ComponentPropsWithRef<'img'> {
	width?: number // either width or height is required
	height?: number
	fit?: keyof FitEnum // contain is default
	alt: string
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(
	({ width, height, fit, className, src, id, ...props }, forwardedRef) => {
		id = id || useId()
		const srcSet = createSrcSet()
		const [isLoaded, setIsLoaded] = useState(false)

		// Reset isLoaded state when src changes
		useEffect(() => {
			setIsLoaded(false)
		}, [src])

		return (
			<Avatar asChild className="w-full h-full rounded-md relative">
				<picture className="block w-full h-full relative">
					{/* Add an aspect ratio container */}
					{/* <div className="relative w-full pb-[56.25%]"> */}
						{' '}
						{/* 16:9 aspect ratio */}
						{Object.values(IMAGE_SRCSET_CONFIG).map((config) => (
							<source
								key={config.media}
								media={config.media}
								srcSet={`/api/images?w=${config.width}&h=${
									config.height
								}&fit=${config.fit}&image=${src!}`}
							/>
						))}
						<AvatarImage
							key={`${id}-${src}`} // Add src to key to force remount
							ref={forwardedRef}
							src={`/api/images?w=${
								IMAGE_SRCSET_CONFIG.sm.width
							}&h=${
								IMAGE_SRCSET_CONFIG.sm.height
							}&fit=cover&image=${src!}`}
							// srcSet={srcSet}
							// sizes="(max-width: 480px) 480px,(max-width: 768px) 768px, (max-width: 1024px) 1024px, 1440px"
							className={cn(
								' w-full h-full object-cover rounded',
								className,
								'transition-opacity duration-300',
								isLoaded ? 'opacity-100' : 'opacity-0'
							)}
							onLoad={() => setIsLoaded(true)}
							{...props}
						/>
					{/* </div> */}
					<AvatarFallback asChild>
						<AnimatePresence mode="sync">
							{!isLoaded && (
								<motion.div
									variants={variants}
									initial="initial"
									exit="exit"
									className="absolute inset-0"
								>
									<Skeleton className="w-full h-full rounded bg-muted/50 animate-pulse" />
								</motion.div>
							)}
						</AnimatePresence>
					</AvatarFallback>
				</picture>
			</Avatar>
		)
		function createImageUrlParams() {
			const query = new URLSearchParams()
			if (width) {
				query.set('w', width.toString())
			}
			if (height) {
				query.set('h', height.toString())
			}
			if (fit) {
				query.set('fit', fit)
			}
			query.set('image', src!)
			return query.toString()
		}

		function createSrcSet() {
			return Object.values(IMAGE_SRCSET_CONFIG)
				.map(
					(config) =>
						`/api/images?w=${config.width}&h=${config.height}&fit=${
							config.fit
						}&image=${src!} ${config.width}w`
				)
				.join(', ')
		}
	}
)

Image.displayName = 'Image'
