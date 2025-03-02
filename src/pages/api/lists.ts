import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth/[...nextauth]"
import { db } from "@/lib/firebaseAdmin"

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({
        error: "You must be signed in to view the protected content on this page.",
      })
    }

    const snapshot = await db.collection('lists').where("userID", "==", session.user?.id).get()
    const lists = snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...doc.data()
      }
    })

    
    res.json({
      data: lists,
      content: `This is protected content. You can access this content because you are signed in. Current user: ${session.user?.email} - ${session.user?.id}`,
    })
  } catch (error) {
    console.error('Error accessing Firestore:', error)
    res.status(500).json({
      error: 'Internal server error while accessing Firestore'
    })
  }
}