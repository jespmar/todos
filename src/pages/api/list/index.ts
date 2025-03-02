import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]"
import { db } from "@/lib/firebaseAdmin"

type Data = {
  lists?: any[]
  error?: string
  id?: string
  title?: string
  todos?: any[]
  userID?: string
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

    switch (req.method) {
      case 'GET':
        const snapshot = await db.collection('lists').where("userID", "==", session.user?.id).get()
        const lists = await Promise.all(snapshot.docs.map(async (doc) => {
          const todosSnapshot = await db.collection(`lists/${doc.id}/todos`).get()
          const todos = todosSnapshot.docs.map(todoDoc => ({
            id: todoDoc.id,
            ...todoDoc.data()
          }))
          
          return {
            id: doc.id,
            todos,
            ...doc.data()
          }
        }))
        
        return res.json({ lists })

      case 'POST':
        const { title } = req.body
        if (!title) {
          return res.status(400).json({ error: "Title is required" })
        }

        const newList = await db.collection('lists').add({
          title,
          userID: session.user?.id,
          createdAt: new Date().toISOString()
        })

        return res.status(201).json({
          id: newList.id,
          title,
          todos: [],
          userID: session.user?.id
        })

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        return res.status(405).end(`Method ${req.method} Not Allowed`)
    }
  } catch (error) {
    console.error('API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
