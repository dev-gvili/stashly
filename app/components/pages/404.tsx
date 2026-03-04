import { Link } from 'react-router'
import { Button } from '@/ui/button'

export function NotFound() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background text-center my-auto">
      <div className="flex flex-col items-center justify-center gap-6 p-8 text-center font-stashly container">
        <div className="space-y-2">
          <h1 className="text-4xl text-foreground">404</h1>
          <p className="text-xl  text-muted-foreground">Page Not Found</p>
        </div>

        <p className="max-w-max text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link> */}
      </div>
    </div>
  )
}
