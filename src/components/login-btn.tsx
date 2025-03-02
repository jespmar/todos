import { useSession, signIn, signOut } from "next-auth/react"

interface LoginBtnProps {
  className?: string;
}

export default function LoginBtn({ className }: LoginBtnProps) {
  const { data: session } = useSession()
  if (session && session.user?.email) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-slate-600 dark:text-slate-400">
          {session.user.name}
        </span>
        <button 
          onClick={() => signOut()} 
          className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <button 
        onClick={() => signIn()} 
        className={className || "px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"}
      >
        Sign in
      </button>
    </div>
  )
}
