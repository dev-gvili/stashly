import { redirect } from 'react-router'
import { auth } from '../../services/auth.server'
import type { Route } from './+types/sign-in'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card'
import { cn } from '@/utils/styles'
import { AuthButton } from '../../components/auth/button'

export const meta: Route.MetaFunction = (props) => [
	{ title: 'Stashly | sign-in' },
]

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = await auth.api.getSession({
		query: {
			disableCookieCache: true,
		},
		headers: request.headers,
	})

	if (session) {
		return redirect('/dashboard')
	}
	return null
}

export default function SignIn() {
	return (
		<div className={cn('flex flex-col gap-6')}>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>
						Login with your Social account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-6">
						<div className="grid gap-4">
							<AuthButton
								provider="github"
								className="w-full font-serif"
                                variant='outline'
								size="default"
							>
								Login with Github
							</AuthButton>
							<AuthButton
								provider="google"
								className="w-full font-serif"
                                variant='outline'
								size="default"
							>
								Login with Google
							</AuthButton>
							<AuthButton
								provider="microsoft"
                                variant='outline'
								className="w-full font-serif"
							>
								Login with Microsoft
							</AuthButton>
							{/* <AuthButton
								provider="apple"
								className="w-full font-serif"
							>
								Login with Apple
							</AuthButton> */}
						</div>
					</div>
				</CardContent>
			</Card>
			<div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary  ">
				By clicking continue, you agree to our{' '}
				{/* biome-ignore lint/a11y/useValidAnchor: <explanation> */}
				<a href="#">Terms of Service</a> and{' '}
				{/* biome-ignore lint/a11y/useValidAnchor: <explanation> */}
				<a href="#">Privacy Policy</a>.
			</div>
		</div>
	)
}
