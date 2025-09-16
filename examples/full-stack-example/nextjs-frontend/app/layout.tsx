import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header, HeaderContainer, HeaderLogo, HeaderNav, HeaderActions } from '@/components/ui/header'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Better Auth + Apso | Modern Authentication Platform',
  description: 'Professional authentication solution combining Better Auth and Apso for enterprise-grade security and developer experience.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-background">
          <Header>
            <HeaderContainer>
              <HeaderLogo>
                <Link href="/" className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {/* Better Auth Logo */}
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">BA</span>
                    </div>
                    {/* Plus Symbol */}
                    <span className="text-muted-foreground font-medium">+</span>
                    {/* Apso Logo */}
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <span className="text-white font-bold text-sm">A</span>
                    </div>
                  </div>
                  <span className="font-bold text-xl">
                    <span className="text-blue-600">Better Auth</span> <span className="text-muted-foreground">+</span> <span className="text-primary">Apso</span>
                  </span>
                </Link>
              </HeaderLogo>
              
              <HeaderNav className="hidden md:flex ml-6">
                <Link 
                  href="/" 
                  className="transition-colors hover:text-primary text-muted-foreground"
                >
                  Home
                </Link>
                <Link 
                  href="/dashboard" 
                  className="transition-colors hover:text-primary text-muted-foreground"
                >
                  Dashboard
                </Link>
                <a 
                  href="https://www.better-auth.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-primary text-muted-foreground"
                >
                  Docs
                </a>
              </HeaderNav>
              
              <HeaderActions>
                {/* User actions will be added here */}
              </HeaderActions>
            </HeaderContainer>
          </Header>
          
          <main>
            {children}
          </main>
          
          <footer className="border-t bg-muted/50 py-12 mt-20">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">BA</span>
                      </div>
                      <span className="text-muted-foreground">+</span>
                      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold text-sm">A</span>
                      </div>
                    </div>
                    <span className="font-bold text-lg">Better Auth + Apso</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Modern authentication platform combining the power of Better Auth with Apso's developer-focused tools.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Better Auth</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="https://www.better-auth.com/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Documentation</a></li>
                    <li><a href="https://github.com/better-auth/better-auth" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">GitHub</a></li>
                    <li><a href="https://www.better-auth.com/docs/concepts" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Concepts</a></li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4">Apso</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><a href="https://apso.ai" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Platform</a></li>
                    <li><a href="https://apso.ai/docs" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Documentation</a></li>
                    <li><a href="https://apso.ai/examples" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Examples</a></li>
                  </ul>
                </div>
              </div>
              
              <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
                <p>&copy; 2024 Better Auth + Apso Example. Built with modern web technologies.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}