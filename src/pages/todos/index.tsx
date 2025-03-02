import { useSession } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/layout'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]'

type TodoStatus = 'todo' | 'doing' | 'completed'

interface Todo {
    id: string
    title: string
    status: TodoStatus
    createdAt: string
}

interface TodoList {
    id: string
    title: string
    todos: Todo[]
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await getServerSession(context.req, context.res, authOptions)

    if (!session) {
        return {
            redirect: {
                destination: '/auth/signin',
                permanent: false,
            },
        }
    }

    return {
        props: {}
    }
}

const getStatusStyle = (status: TodoStatus): string => {
    switch (status) {
        case 'completed':
            return 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-500/20 hover:bg-green-100 dark:hover:bg-green-500/30'
        case 'doing':
            return 'border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-500/20 hover:bg-yellow-100 dark:hover:bg-yellow-500/30'
        default:
            return 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
    }
}

const getTitleStyle = (status: TodoStatus): string => {
    switch (status) {
        case 'todo':
            return 'text-slate-900 dark:text-slate-100'
        case 'doing':
            return 'text-yellow-700 dark:text-yellow-400 font-medium'
        case 'completed':
            return 'line-through text-slate-500 dark:text-slate-400'
    }
}

export default function Todos() {
    const { data: session } = useSession()
    const [lists, setLists] = useState<TodoList[]>([])
    const [activeList, setActiveList] = useState<string | null>('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isCreatingList, setIsCreatingList] = useState(false)
    const [newListTitle, setNewListTitle] = useState('')
    const [newTodoTitle, setNewTodoTitle] = useState('')
    const [isAddingTodo, setIsAddingTodo] = useState(false)
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [movingTodoId, setMovingTodoId] = useState<string | null>(null)
    const [isMovingTodo, setIsMovingTodo] = useState(false)
    const [editingListId, setEditingListId] = useState<string | null>(null)
    const [editingListTitle, setEditingListTitle] = useState<string>('')

    const fetchLists = useCallback(async () => {
        try {
            const response = await fetch('/api/list')
            if (!response.ok) {
                throw new Error('Failed to fetch lists')
            }
            const data = await response.json()
            setLists(data.lists)
            if (data.lists.length > 0 && !activeList) {
                setActiveList(data.lists[0].id)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }, [activeList])

    useEffect(() => {
        if (session) {
            fetchLists()
        }
    }, [session, fetchLists])

    const updateLocalTodos = useCallback((listId: string, updater: (todos: Todo[]) => Todo[]) => {
        setLists(currentLists => {
            const newLists = currentLists.map(list => {
                if (list.id === listId) {
                    const newTodos = updater(list.todos);
                    console.log('Updating todos for list:', listId, { oldTodos: list.todos, newTodos });
                    return { ...list, todos: newTodos };
                }
                return list;
            });
            return newLists;
        });
    }, [])

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeList || !newTodoTitle.trim()) return

        try {
            const response = await fetch(`/api/list/${activeList}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: newTodoTitle.trim() }),
            })

            if (!response.ok) {
                throw new Error('Failed to add todo')
            }

            const data = await response.json()
            setLists(lists =>
                lists.map(list =>
                    list.id === activeList
                        ? {
                            ...list,
                            todos: [
                                ...list.todos,
                                { 
                                    id: data.id, 
                                    title: data.title, 
                                    status: 'todo' as const,
                                    createdAt: new Date().toISOString()
                                },
                            ],
                        }
                        : list
                )
            )
            setNewTodoTitle('')
            setIsAddingTodo(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add todo')
        }
    }

    const handleUpdateTodoTitle = async (todoId: string, newTitle: string) => {
        if (!activeList || !newTitle.trim()) {
            setEditingTodoId(null)
            return
        }

        try {
            const response = await fetch(`/api/list/${activeList}/todos`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ todoId, title: newTitle.trim() }),
            })

            if (!response.ok) {
                throw new Error('Failed to update todo')
            }

            updateLocalTodos(activeList, todos =>
                todos.map(todo =>
                    todo.id === todoId ? { ...todo, title: newTitle.trim() } : todo
                )
            )
            setEditingTodoId(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update todo')
        }
    }

    const handleToggleTodoStatus = async (todoId: string) => {
        // Find which list contains this todo
        let listId: string | null = null
        let todo: Todo | null = null

        // If we're on a specific list page, use that as the source
        if (activeList) {
            listId = activeList
            const foundTodo = lists.find(l => l.id === activeList)?.todos.find(t => t.id === todoId)
            if (foundTodo) {
                todo = foundTodo
            }
        } else {
            // Otherwise search all lists
            for (const list of lists) {
                const foundTodo = list.todos.find(t => t.id === todoId)
                if (foundTodo) {
                    listId = list.id
                    todo = foundTodo
                    break
                }
            }
        }

        if (!listId || !todo) return

        let newStatus: TodoStatus
        switch (todo.status) {
            case 'todo':
                newStatus = 'doing'
                break
            case 'doing':
                newStatus = 'completed'
                break
            case 'completed':
                newStatus = 'todo'
                break
            default:
                newStatus = 'todo'
        }

        // Optimistically update the UI
        setLists(lists =>
            lists.map(list =>
                list.id === listId
                    ? {
                        ...list,
                        todos: list.todos.map(t =>
                            t.id === todoId ? { ...t, status: newStatus } : t
                        ),
                    }
                    : list
            )
        )

        // Send update to server in the background
        try {
            const response = await fetch(`/api/list/${listId}/todos`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ todoId, status: newStatus }),
            })

            if (!response.ok) {
                throw new Error('Failed to update todo')
            }
        } catch (err) {
            // Revert the optimistic update on error
            setLists(lists =>
                lists.map(list =>
                    list.id === listId
                        ? {
                            ...list,
                            todos: list.todos.map(t =>
                                t.id === todoId ? { ...t, status: todo.status } : t
                            ),
                        }
                        : list
                )
            )
            setError(err instanceof Error ? err.message : 'Failed to update todo')
        }
    }

    const handleMoveTodo = async (todoId: string, targetListId: string) => {
        // Find source list and todo
        let sourceListId: string | null = null
        let todo: Todo | null = null

        // Search all lists to find the source list and todo
        for (const list of lists) {
            const foundTodo = list.todos.find(t => t.id === todoId)
            if (foundTodo) {
                sourceListId = list.id
                todo = foundTodo
                break
            }
        }

        if (!sourceListId || !todo || sourceListId === targetListId) return

        const updatedTodo = {
            ...todo!,
            updatedAt: new Date().toISOString()
        }

        // Optimistically update UI
        setLists(lists =>
            lists.map(list => {
                if (list.id === sourceListId) {
                    return {
                        ...list,
                        todos: list.todos.filter(t => t.id !== todoId)
                    }
                }
                if (list.id === targetListId) {
                    return {
                        ...list,
                        todos: [...list.todos, updatedTodo]
                    }
                }
                return list
            })
        )

        try {
            const response = await fetch(`/api/list/${sourceListId}/todos/${todoId}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ targetListId })
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || 'Failed to move todo')
            }

            // Server confirmed the move, no need to update state again
            // as our optimistic update matches the server state
        } catch (err) {
            // Revert the optimistic update on error
            setLists(lists =>
                lists.map(list => {
                    if (list.id === sourceListId) {
                        return {
                            ...list,
                            todos: [...list.todos, updatedTodo]
                        }
                    }
                    if (list.id === targetListId) {
                        return {
                            ...list,
                            todos: list.todos.filter(t => t.id !== todoId)
                        }
                    }
                    return list
                })
            )
            console.error('Error moving todo:', err)
            setError('Failed to move todo')
        }

        setMovingTodoId(null)
        setIsMovingTodo(false)
    }

    const handleDeleteTodo = async (todoId: string) => {
        if (!activeList) return

        try {
            const response = await fetch(`/api/list/${activeList}/todos`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ todoId }),
            })

            if (!response.ok) {
                throw new Error('Failed to delete todo')
            }

            updateLocalTodos(activeList, todos =>
                todos.filter(todo => todo.id !== todoId)
            )
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete todo')
        }
    }

    const handleUpdateListTitle = async (listId: string, newTitle: string) => {
        if (!newTitle.trim()) {
            setEditingListId(null)
            return
        }

        try {
            const response = await fetch(`/api/list/${listId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: newTitle.trim() }),
            })

            if (!response.ok) {
                throw new Error('Failed to update list')
            }

            setLists(lists =>
                lists.map(list =>
                    list.id === listId ? { ...list, title: newTitle.trim() } : list
                )
            )
            setEditingListId(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update list')
        }
    }

    const handleCreateList = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newListTitle.trim()) return

        try {
            const response = await fetch('/api/list', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: newListTitle.trim() }),
            })

            if (!response.ok) {
                throw new Error('Failed to create list')
            }

            const newList = await response.json()
            setLists([...lists, { ...newList, todos: [] }])
            setActiveList(newList.id)
            setNewListTitle('')
            setIsCreatingList(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create list')
        }
    }

    if (!session) {
        return (
            <Layout>
                <div className="flex items-center justify-center w-full">
                    <p className="text-xl">Please sign in to view your todo lists</p>
                </div>
            </Layout>
        )
    }

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center w-full">
                    <p className="text-xl text-slate-900 dark:text-slate-100">Loading...</p>
                </div>
            </Layout>
        )
    }

    if (error) {
        return (
            <Layout>
                <div className="flex items-center justify-center w-full">
                    <p className="text-xl text-red-500">Error: {error}</p>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <div className="flex flex-col w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-xl transition-colors duration-200">
                {/* Tab Menu */}
                <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-2 gap-2 border-b border-slate-200 dark:border-slate-700">
                    <div key="all" className="relative group">
                        <button
                            onClick={() => setActiveList('all')}
                            className={`px-4 py-2 rounded-lg transition-colors ${activeList === 'all'
                                ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-900 dark:text-white'
                                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                        >
                            All Todos
                        </button>
                    </div>
                    {lists.map((list) => (
                        <div key={list.id} className="relative group">
                            {editingListId === list.id ? (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleUpdateListTitle(list.id, editingListTitle);
                                    }}
                                    className="inline-block"
                                >
                                    <input
                                        type="text"
                                        value={editingListTitle || ''}
                                        onChange={(e) => setEditingListTitle(e.target.value)}
                                        onBlur={() => handleUpdateListTitle(list.id, editingListTitle)}
                                        className={`px-4 py-2 rounded-lg transition-colors ${activeList === list.id
                                            ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-900 dark:text-white'
                                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                                        autoFocus
                                    />
                                </form>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setActiveList(list.id)}
                                        className={`px-4 py-2 rounded-lg transition-colors ${activeList === list.id
                                            ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-900 dark:text-white'
                                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                    >
                                        {list.title}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingListId(list.id);
                                            setEditingListTitle(list.title || '');
                                        }}
                                        className="hidden group-hover:block p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                        title="Edit list name"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {isCreatingList ? (
                        <form onSubmit={handleCreateList} className="flex gap-2 ml-auto">
                            <input
                                type="text"
                                value={newListTitle}
                                onChange={(e) => setNewListTitle(e.target.value)}
                                placeholder="List name"
                                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 rounded-lg bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500 transition-colors"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreatingList(false)
                                    setNewListTitle('')
                                }}
                                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <button
                            className="px-4 py-2 rounded-lg bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-500 transition-colors ml-auto"
                            onClick={() => setIsCreatingList(true)}
                        >
                            New List
                        </button>
                    )}
                </div>

                {/* Active List Content */}
                <div className="p-4">
                    {activeList === 'all' ? (
                        <div className="space-y-8">
                            {lists.map(list => (
                                <div key={list.id} className="space-y-4">
                                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        {list.title}
                                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({list.todos.length} items)</span>
                                    </h2>
                                    <div className="space-y-2">
                                        {list.todos.map((todo) => (
                                            <div
                                                key={todo.id}
                                                className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-200"
                                            >
                                                <button
                                                    onClick={() => handleToggleTodoStatus(todo.id)}
                                                    className={`w-6 h-6 rounded-full border-2 transition-colors duration-200 ${getStatusStyle(todo.status)}`}
                                                    title={`Status: ${todo.status}`}
                                                >
                                                    {todo.status === 'completed' && (
                                                        <svg className="w-4 h-4 mx-auto text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                                {editingTodoId === todo.id ? (
                                                    <form
                                                        className="flex-1"
                                                        onSubmit={(e) => {
                                                            e.preventDefault()
                                                            handleUpdateTodoTitle(todo.id, editingTitle)
                                                        }}
                                                    >
                                                        <input
                                                            type="text"
                                                            value={editingTitle}
                                                            onChange={(e) => setEditingTitle(e.target.value)}
                                                            onBlur={() => handleUpdateTodoTitle(todo.id, editingTitle)}
                                                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            autoFocus
                                                        />
                                                    </form>
                                                ) : (
                                                    <div className="flex-1 flex items-center gap-2">
                                                        <span
                                                            className={`flex-1 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors ${getTitleStyle(todo.status)}`}
                                                            onClick={() => {
                                                                setEditingTodoId(todo.id);
                                                                setEditingTitle(todo.title);
                                                            }}
                                                        >
                                                            {todo.title}
                                                        </span>
                                                        {todo.status === 'doing' && (
                                                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full whitespace-nowrap">
                                                                Doing
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(todo.createdAt).toLocaleString('sv-SE', {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: false
                                                        })}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                            onClick={() => {
                                                                setMovingTodoId(todo.id)
                                                                setIsMovingTodo(true)
                                                            }}
                                                            title="Move todo"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                            onClick={() => handleDeleteTodo(todo.id)}
                                                            title="Delete todo"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    {isMovingTodo && movingTodoId === todo.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                                                            {lists.map(targetList => (
                                                                <button
                                                                    key={targetList.id}
                                                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                                    onClick={() => handleMoveTodo(todo.id, targetList.id)}
                                                                    disabled={targetList.id === list.id}
                                                                >
                                                                    Move to {targetList.title}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : activeList && lists.find(l => l.id === activeList)?.todos ? (
                        <div>
                            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
                                {lists.find(l => l.id === activeList)?.title}
                            </h2>
                            <div className="space-y-2">
                                {lists.find(l => l.id === activeList)?.todos.map((todo) => (
                                    <div
                                        key={todo.id}
                                        className="flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-200"
                                    >
                                        <button
                                            onClick={() => handleToggleTodoStatus(todo.id)}
                                            className={`w-6 h-6 rounded-full border-2 transition-colors duration-200 ${getStatusStyle(todo.status)}`}
                                            title={`Status: ${todo.status}`}
                                        />
                                        {editingTodoId === todo.id ? (
                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleUpdateTodoTitle(todo.id, editingTitle);
                                                }}
                                                className="flex-1"
                                            >
                                                <input
                                                    type="text"
                                                    value={editingTitle}
                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                    onBlur={() => handleUpdateTodoTitle(todo.id, editingTitle)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    autoFocus
                                                />
                                            </form>
                                        ) : (
                                            <div className="flex-1 flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                onClick={() => {
                                                    setEditingTodoId(todo.id);
                                                    setEditingTitle(todo.title);
                                                }}
                                            >
                                                <span className={getTitleStyle(todo.status)}>
                                                    {todo.title}
                                                </span>
                                                {todo.status === 'doing' && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full whitespace-nowrap">
                                                        Doing
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">
                                                {new Date(todo.createdAt).toLocaleString('sv-SE', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false
                                                })}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                    onClick={() => {
                                                        setMovingTodoId(todo.id)
                                                        setIsMovingTodo(true)
                                                    }}
                                                    title="Move todo"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                    onClick={() => handleDeleteTodo(todo.id)}
                                                    title="Delete todo"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                                {isMovingTodo && movingTodoId === todo.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                                                        {lists.map(targetList => (
                                                            <button
                                                                key={targetList.id}
                                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                                onClick={() => handleMoveTodo(todo.id, targetList.id)}
                                                                disabled={targetList.id === activeList}
                                                            >
                                                                Move to {targetList.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {isAddingTodo ? (
                                <form onSubmit={handleAddTodo} className="mt-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newTodoTitle}
                                            onChange={(e) => setNewTodoTitle(e.target.value)}
                                            placeholder="What needs to be done?"
                                            className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded-lg bg-indigo-500 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddingTodo(false)
                                                setNewTodoTitle('')
                                            }}
                                            className="px-4 py-2 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    className="w-full mt-4 px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                    onClick={() => setIsAddingTodo(true)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Todo
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            {lists.length === 0 ? (
                                <p>Create your first todo list to get started!</p>
                            ) : (
                                <p>Select a list to view its todos</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}