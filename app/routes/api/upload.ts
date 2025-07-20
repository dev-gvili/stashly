import { z } from 'zod'
import type { Route } from './+types/upload'

export async function loader({ request, params }: Route.LoaderArgs) {
	// TODO: implement loader logic
	return null
}

const schema = z.object({
	files: z.array(z.instanceof(File)).or(z.instanceof(File)),
})

export async function action({ request, params }: Route.ActionArgs) {
	// TODO: implement action logic
	// const session = await auth.api.getSession(request)
	// const data = await parseFormData({ request, schema })
	// if (!data) {
	// 	return { error: 'Invalid form data', data }
	// }

	// const files = data.files
	// if (Array.isArray(files)) {
	// 	files.forEach((file) => {
	// 		uploadService.send({
	// 			type: 'START',
	// 			file,
	// 			user: session?.user!,
	// 		})
	// 	})
	// } else {
	// 	uploadService.send({
	// 		type: 'START',
	// 		file: files,
	// 		user: session?.user!,
	// 	})
	// }

	// uploadService.subscribe(({ context, value, output }) => {
	// 	console.log('Upload state changed:', context, value, output)
	// })

	// parse incoming form data and handle file uploads
	// return appropriate response based on upload success or failure
	// e.g., return { results: [{ id: 'file1', success: true }] }
	// For now, just return null to avoid errors

	return null
}
