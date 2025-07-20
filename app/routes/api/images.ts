/**
 * An on the fly image resizer
 *
 * Since most of our images are served via a CDN, we don't have to save the resized images.
 * Instead we set cache headers for them and let the cdn cache them for us.
 *
 * sharp uses a highly performant native package called libvips.
 * it's written in C and is extremely fast.
 *
 * The implementation of the demo uses a stream based approach where the image is never stored in memory.
 * This means it's very good at handling images of any size, and is extremely performant.
 * Further improvements could be done by implementing ETags, but that is out of scope for this demo.
 */

import { PassThrough, Readable } from 'stream'
import type { FitEnum } from 'sharp'
import sharp from 'sharp'
import type { Route } from './+types/images'

interface ResizeParams {
	width: number | undefined
	height: number | undefined
	fit: keyof FitEnum
	image: string
}

function extractParams(request: Request): ResizeParams {
	const searchParams = new URL(request.url).searchParams

	const width = searchParams.has('w')
		? Number.parseInt(searchParams.get('w') ?? '0')
		: undefined
	const height = searchParams.has('h')
		? Number.parseInt(searchParams.get('h') ?? '0')
		: undefined
	const image = searchParams.has('image')
		? (searchParams.get('image') as string)
		: ''

	const fitEnum = ['contain', 'cover', 'fill', 'inside', 'outside']
	let fit: keyof FitEnum = sharp.fit.contain
	if (searchParams.has('fit')) {
		const fitParam = searchParams.get('fit') ?? ''
		if (fitEnum.includes(fitParam)) {
			fit = fitParam as keyof FitEnum
		}
	}
	return { width, height, fit, image }
}

export const loader = async ({ request }: Route.LoaderArgs) => {
	const url = new URL(request.url)
	let params = extractParams(request)
	if (!params.image) {
		throw new Error('Image URL is required')
	}
	try {
		let response = await fetch(params.image)
		if (!response.ok) {
			throw new Error('Failed to fetch image')
		}

		// Create streams
		const passThroughStream = new PassThrough()
		// Convert web ReadableStream to Node.js Readable stream
		let imageStream = Readable.fromWeb(
			response.body as import('stream/web').ReadableStream<Uint8Array>
		)

		// Create transform stream with metadata event
		const transformStream = sharp()
			.resize({
				fit: params.fit,
				width: params.width,
				height: params.height,
				position: 'top',
			})
			.greyscale()
			.webp({
				quality: 70,
				preset: 'photo',
			})

		// Pipe streams
		imageStream.pipe(transformStream).pipe(passThroughStream)

		// Return response with headers
		return new Response(passThroughStream as any, {
			headers: {
				'Content-Type': `image/webp`,
				'Content-Disposition': `inline; filename="${params.image}"`,
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	} catch (error: unknown) {
		return handleError(error)
	}
}

function handleError(error: unknown) {
	// error needs to be typed
	const errorT = error as Error & { code: string }
	// if the read stream fails, it will have the error.code ENOENT
	if (errorT.code === 'ENOENT') {
		return new Response('image not found', {
			status: 404,
			headers: {
				'Content-Type': 'text/plain',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			},
		})
	}

	// if there is an error processing the image, we return a 500 error
	return new Response(errorT.message, {
		status: 500,
		statusText: errorT.message,
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
		},
	})
}
