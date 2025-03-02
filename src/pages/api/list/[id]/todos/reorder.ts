import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]'
import { db } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { todoId, newIndex } = req.body

  if (!id || typeof id !== 'string' || !todoId || typeof newIndex !== 'number') {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const listRef = db.collection('lists').doc(id)
    const listDoc = await listRef.get()

    if (!listDoc.exists) {
      return res.status(404).json({ error: 'List not found' })
    }

    const list = listDoc.data()
    if (list?.userId !== session.user?.email) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Find the todo and remove it from its current position
    const todos = list.todos || []
    const todoIndex = todos.findIndex((t: any) => t.id === todoId)
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' })
    }

    const [todo] = todos.splice(todoIndex, 1)
    // Insert the todo at the new position
    todos.splice(newIndex, 0, todo)

    // Update the list with the new todo order
    await listRef.update({ todos })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error reordering todo:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
