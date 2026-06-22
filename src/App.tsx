import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '@/context/SessionContext'
import { AppSidebar } from '@/components/outdoorscan/AppSidebar'
import { Toaster } from './components/ui/sonner'
import Processamento from './pages/Processamento'
import ConverterBooks from './pages/ConverterBooks'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BrowserRouter>
          <div className="flex min-h-screen w-full bg-background text-foreground">
            <AppSidebar />
            <main className="flex-1 min-w-0">
              <Routes>
                <Route path="/" element={<Processamento />} />
                <Route path="/converter-books" element={<ConverterBooks />} />
              </Routes>
            </main>
          </div>
          <Toaster />
        </BrowserRouter>
      </SessionProvider>
    </QueryClientProvider>
  )
}
