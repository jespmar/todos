import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"
import { db } from "@/lib/firebaseAdmin"

type Data = {
  id?: string
  title?: string
  todos?: Array<{ id: string; text: string; completed: boolean }>
  error?: string
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
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
      case 'GET':
        const todosSnapshot = await db.collection(`lists/${id}/todos`).get()
        const todos = todosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        return res.json({
          id: listDoc.id,
          todos,
          ...listDoc.data()
        })

      case 'PUT':
        const { title } = req.body
        if (!title) {
          return res.status(400).json({ error: "Title is required" })
        }

        await db.collection('lists').doc(id).update({ title })
        return res.json({ message: "List updated successfully" })

      case 'DELETE':
        // Delete all todos in the list
        const batch = db.batch()
        const todosDocs = await db.collection(`lists/${id}/todos`).get()
        todosDocs.docs.forEach(doc => {
          batch.delete(doc.ref)
        })
        // Delete the list itself
        batch.delete(db.collection('lists').doc(id))
        await batch.commit()

        return res.json({ message: "List deleted successfully" })

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}