import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]"
import { db } from "@/lib/firebaseAdmin"

type TodoStatus = 'todo' | 'doing' | 'completed'

type ApiResponse = {
  id?: string
  title?: string
  status?: TodoStatus
  message?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: "Invalid list ID" })
    }

    // Verify list ownership
    const listDoc = await db.collection('lists').doc(id).get()
    if (!listDoc.exists) {
      return res.status(404).json({ error: "List not found" })
    }
    if (listDoc.data()?.userID !== session.user?.id) {
      return res.status(403).json({ error: "Forbidden" })
    }

    switch (req.method) {
      case 'POST': {
        const { title } = req.body
        if (!title || typeof title !== 'string' || !title.trim()) {
          return res.status(400).json({ error: "Title is required" })
        }

        const todoData = {
          title: title.trim(),
          status: 'todo' as TodoStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        const newTodo = await db.collection(`lists/${id}/todos`).add(todoData)

        return res.status(201).json({
          id: newTodo.id,
          title: todoData.title,
          status: todoData.status
        })
      }

      case 'PUT': {
        const { todoId } = req.body
        if (!todoId || typeof todoId !== 'string') {
          return res.status(400).json({ error: "Valid todo ID is required" })
        }

        const todoRef = db.collection(`lists/${id}/todos`).doc(todoId)
        const todoDoc = await todoRef.get()

        if (!todoDoc.exists) {
          return res.status(404).json({ error: "Todo not found" })
        }

        const updates: { status?: TodoStatus; title?: string; updatedAt: string } = {
          updatedAt: new Date().toISOString()
        }

        // Handle status update
        const { status } = req.body
        if (status && ['todo', 'doing', 'completed'].includes(status)) {
          updates.status = status as TodoStatus
        }

        // Handle title update
        const { title } = req.body
        if (typeof title === 'string' && title.trim()) {
          updates.title = title.trim()
        }

        if (!updates.status && !updates.title) {
          return res.status(400).json({ error: "No valid updates provided" })
        }

        await todoRef.update(updates)

        return res.json({
          message: "Todo updated successfully",
          ...updates
        })
      }

      case 'DELETE': {
        const { todoId } = req.body
        if (!todoId || typeof todoId !== 'string') {
          return res.status(400).json({ error: "Valid todo ID is required" })
        }

        const todoRef = db.collection(`lists/${id}/todos`).doc(todoId)
        const todoDoc = await todoRef.get()

        if (!todoDoc.exists) {
          return res.status(404).json({ error: "Todo not found" })
        }

        await todoRef.delete()
        return res.json({ message: "Todo deleted successfully" })
      }

      default:
        res.setHeader('Allow', ['POST', 'PUT', 'DELETE'])
        return res.status(405).json({ error: `Method ${req.method} not allowed` })
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
