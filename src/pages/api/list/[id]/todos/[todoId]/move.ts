import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { db } from '@/lib/firebaseAdmin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id, todoId } = req.query
    const { targetListId } = req.body

    if (!id || !todoId || !targetListId || typeof id !== 'string' || typeof todoId !== 'string' || typeof targetListId !== 'string') {
        return res.status(400).json({ error: 'Missing required parameters' })
    }

    try {
        // Get the source list
        const sourceList = await db.collection('lists').doc(id).get()
        if (!sourceList.exists) {
            return res.status(404).json({ error: 'Source list not found' })
        }

        const sourceListData = sourceList.data()
        if (!sourceListData || sourceListData.userID !== session.user?.id) {
            return res.status(403).json({ error: 'Not authorized to access this list' })
        }

        // Get the todo from the source list's todos subcollection
        const todoDoc = await db.collection(`lists/${id}/todos`).doc(todoId).get()
        if (!todoDoc.exists) {
            return res.status(404).json({ error: 'Todo not found' })
        }
        const todo = { id: todoDoc.id, ...todoDoc.data() }

        // Get the target list
        const targetList = await db.collection('lists').doc(targetListId).get()
        if (!targetList.exists) {
            return res.status(404).json({ error: 'Target list not found' })
        }

        const targetListData = targetList.data()
        if (!targetListData || targetListData.userID !== session.user?.id) {
            return res.status(403).json({ error: 'Not authorized to access target list' })
        }

        // Start a batch write
        const batch = db.batch()

        // Delete todo from source list's subcollection
        const sourceTodoRef = db.collection(`lists/${id}/todos`).doc(todoId)
        batch.delete(sourceTodoRef)

        // Prepare the updated todo data
        const updatedTodo = {
            title: todo.title,
            status: todo.status,
            createdAt: todo.createdAt,
            updatedAt: new Date().toISOString()
        }

        // Add todo to target list's subcollection
        const targetTodoRef = db.collection(`lists/${targetListId}/todos`).doc(todoId)
        batch.set(targetTodoRef, updatedTodo)

        // Commit the batch
        await batch.commit()

        return res.status(200).json({
            success: true,
            todo: {
                id: todoId,
                ...updatedTodo
            }
        })
    } catch (error) {
        console.error('Error moving todo:', error)
        return res.status(500).json({ error: 'Failed to move todo' })
    }
}
