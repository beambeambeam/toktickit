import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <main className="page">
      <h1>Welcome Home!</h1>
    </main>
  )
}
