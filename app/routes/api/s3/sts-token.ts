import { data, type ActionFunctionArgs } from 'react-router'
import { STSClient, GetSessionTokenCommand } from '@aws-sdk/client-sts'
// This is an example, replace with your actual authentication check
import { auth } from '@/.server/auth'

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request) // Ensure the user is authenticated

  const stsClient = new STSClient({ region: process.env.AWS_REGION })
  const command = new GetSessionTokenCommand({
    // Credentials will be valid for 1 hour.
    DurationSeconds: 3600,
  })

  try {
    const stsData = await stsClient.send(command)
    if (!stsData.Credentials) {
      throw new Error('Failed to get temporary credentials.')
    }
    return data({
      accessKeyId: stsData.Credentials.AccessKeyId,
      secretAccessKey: stsData.Credentials.SecretAccessKey,
      sessionToken: stsData.Credentials.SessionToken,
      expiration: stsData.Credentials.Expiration,
    })
  } catch (error) {
    console.error('Failed to get STS token:', error)
    return data(
      { error: 'Could not retrieve temporary credentials' },
      { status: 500 }
    )
  }
}

// Note: You will need to implement or verify the `requireUser` function in your auth service.
// It should throw a Response if the user is not authenticated.
async function requireUser(request: Request) {
  const session = await auth.api.getSession(request)
  if (!session) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return session.user
}
