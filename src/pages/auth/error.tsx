import { useRouter } from 'next/router'
import Layout from '@/components/layout'

export default function Error() {
  const router = useRouter()
  const { error } = router.query

  return (
    <Layout>
      <h1>Authentication Error</h1>
      <div>
        <p>An error occurred during authentication:</p>
        {error && <p className="text-red-500">{error}</p>}
        <button
          onClick={() => router.push('/auth/signin')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    </Layout>
  )
}
