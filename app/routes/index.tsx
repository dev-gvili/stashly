// import logo2 from '@/assets/logo2.png?url'
// import { AspectRatio } from '../components/ui/aspect-ratio'
// import logo1 from '@/assets/logo1.png?url'

import { redirect } from "react-router"

export const loader = async () => {
	// return { logo1, logo2 }
	return redirect('/dashboard')
}

export default function Index() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen font-sans">
			<h1>Welcome to Stashly</h1>
			<p className="text-gray-500">
				Your personal file management system.
			</p>
			<p className="text-gray-500">Please sign in to continue.</p>
		</div>
	)
}
