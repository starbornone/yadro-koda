import { HeadContent, Outlet } from '@tanstack/react-router'

function App() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  )
}

export default App
