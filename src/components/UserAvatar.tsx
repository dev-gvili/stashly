interface UserAvatarProps {
  initial: string
  className?: string
}

export function UserAvatar({ initial, className = "w-6 h-6" }: UserAvatarProps) {
  const colors = {
    'A': 'bg-purple-500',
    'B': 'bg-green-500',
    'N': 'bg-blue-500',
    'G': 'bg-orange-500'
  }
  
  return (
    <div className={`${className} rounded-full ${colors[initial as keyof typeof colors] || 'bg-muted'} flex items-center justify-center text-white text-xs font-medium`}>
      {initial}
    </div>
  )
}
