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
                  <div className="flex items-center space-x-3">
                    {/* Better Auth Logo */}
                    <img
                      src="/logos/better-auth-logo-dark.svg"
                      alt="Better Auth"
                      className="h-8 w-auto"
                    />
                    {/* Plus Symbol */}
                    <span className="text-muted-foreground font-medium text-lg">+</span>
                    {/* Apso Logo */}
                    <img
                      src="/logos/apso-logo.svg"
                      alt="Apso"
                      className="h-8 w-auto"
                    />
                  </div>
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
                  <div className="flex items-center space-x-3 mb-4">
                    <img
                      src="/logos/better-auth-logo-wordmark-dark.svg"
                      alt="Better Auth"
                      className="h-6 w-auto"
                    />
                    <span className="text-muted-foreground">+</span>
                    <img
                      src="/logos/apso-wordmark.svg"
                      alt="Apso"
                      className="h-6 w-auto"
                    />
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