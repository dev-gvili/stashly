import type { Route } from './+types/trash'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

const FileTextIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="256"
      height="256"
      viewBox="0 0 256 256"
    >
      <rect width="256" height="256" fill="none" />

      {/* Back document */}
      <g transform="translate(36,28)">
        <rect
          x="0"
          y="0"
          width="140"
          height="180"
          rx="12"
          ry="12"
          fill="#E5E5E5" // light gray
          stroke="#9CA3AF" // medium gray
          strokeWidth="3"
        />
        <rect x="18" y="26" width="104" height="10" rx="5" fill="#D1D5DB" />
        <rect x="18" y="46" width="92" height="10" rx="5" fill="#D1D5DB" />
        <rect x="18" y="66" width="88" height="10" rx="5" fill="#D1D5DB" />
        <rect x="18" y="86" width="100" height="10" rx="5" fill="#D1D5DB" />
        <rect x="18" y="106" width="84" height="10" rx="5" fill="#D1D5DB" />
      </g>

      {/* Front document */}
      <g transform="translate(70,52)">
        <rect
          x="0"
          y="0"
          width="140"
          height="180"
          rx="12"
          ry="12"
          fill="#FFFFFF" // white
          stroke="#4B5563" // dark gray
          strokeWidth="3"
        />
        {/* Folded corner */}
        <path
          d="M140 0 L110 0 L140 30 Z"
          fill="#F3F4F6" // very light gray
          stroke="#4B5563"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Left X eye */}
        <g transform="translate(44,76)">
          <line
            x1="-10"
            y1="-10"
            x2="10"
            y2="10"
            stroke="#111827" // near black
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="-10"
            y1="10"
            x2="10"
            y2="-10"
            stroke="#111827"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>

        {/* Right X eye */}
        <g transform="translate(96,76)">
          <line
            x1="-10"
            y1="-10"
            x2="10"
            y2="10"
            stroke="#111827"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="-10"
            y1="10"
            x2="10"
            y2="-10"
            stroke="#111827"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>

        {/* Sad mouth */}
        <path
          d="M52 126 C64 112, 92 112, 104 126"
          fill="none"
          stroke="#111827"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Error mark changed to gray */}
        <circle cx="120" cy="24" r="6" fill="#6B7280" />
      </g>
    </svg>
  )
}

const PreviewItemEmpty = () => {
  return (
    <div className="flex flex-col w-full gap-y-2 items-center justify-center p-12">
      <FileTextIcon />
      <h1 className="text-sidebar-foreground font-bold text-lg">
        No File Selected
      </h1>
      <p className="text-sidebar-accent-foreground/40 font-medium text-sm text-pretty text-center">
        When you'll select one of the items, you'll be able to see all the
        details and managing options.
      </p>
    </div>
  )
}

export default () => {
  // This is a placeholder component for the trash route.
  // You can implement your trash UI here.
  return (
    <div>
      <PreviewItemEmpty />
      Trash Route
    </div>
  )
}
