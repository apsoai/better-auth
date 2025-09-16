'use client'

import Link from 'next/link'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Shield, Zap, Code, Database, Users, Lock, Star } from 'lucide-react'

export default function HomePage() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-brand-blue/5 to-purple-500/5"></div>
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Star className="w-3 h-3 mr-1" />
              Enterprise-Grade Authentication
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Modern Authentication
              <span className="block text-gradient">
                Made Simple
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Experience the perfect fusion of <strong>Better Auth</strong> and <strong>Apso</strong> -
              delivering enterprise-grade security with developer-friendly tools for modern applications.
            </p>

            {/* Logo Showcase */}
            <div className="flex justify-center items-center gap-12 mb-8">
              <div className="flex flex-col items-center space-y-3">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-100">
                  <img
                    src="/logos/better-auth-logo-dark.svg"
                    alt="Better Auth"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-sm font-medium text-foreground">Better Auth</span>
              </div>

              <div className="text-4xl text-muted-foreground font-light">+</div>

              <div className="flex flex-col items-center space-y-3">
                <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-100">
                  <img
                    src="/logos/apso-logo.svg"
                    alt="Apso"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-sm font-medium text-foreground">Apso</span>
              </div>
            </div>

            {session ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg">
                    <Link href="/dashboard">
                      <Users className="w-4 h-4 mr-2" />
                      Go to Dashboard
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </Button>
                </div>
                
                <Card className="max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="text-2xl">Welcome back, {session.user.name || session.user.email}!</CardTitle>
                    <CardDescription>
                      You're successfully authenticated and ready to explore our platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="text-sm">{session.user.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">User ID</p>
                        <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{session.user.id}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Session ID</p>
                        <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{session.id}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Expires At</p>
                        <p className="text-sm">{new Date(session.expiresAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg">
                    <Link href="/login">
                      <Lock className="w-4 h-4 mr-2" />
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/register">
                      <Users className="w-4 h-4 mr-2" />
                      Create Account
                    </Link>
                  </Button>
                </div>
                <div className="flex justify-center">
                  <Button asChild variant="ghost" size="lg">
                    <a href="/GETTING_STARTED.md" target="_blank" rel="noopener noreferrer">
                      <Code className="w-4 h-4 mr-2" />
                      Setup Guide
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Better Auth + Apso?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Combining best-in-class authentication with powerful developer tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="group hover:shadow-brand transition-all duration-300">
              <CardHeader>
                <Shield className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Bank-grade security with advanced threat protection and compliance features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    End-to-end encryption
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Multi-factor authentication
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    GDPR & SOC2 compliant
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-brand transition-all duration-300">
              <CardHeader>
                <Zap className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Developer Experience</CardTitle>
                <CardDescription>
                  Simple APIs and comprehensive SDKs for rapid integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    TypeScript-first approach
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    React hooks & components
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Comprehensive documentation
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-brand transition-all duration-300">
              <CardHeader>
                <Code className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Apso Integration</CardTitle>
                <CardDescription>
                  Seamless backend generation and API management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Auto-generated APIs
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Database schema sync
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-success mr-2" />
                    Real-time updates
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Technical Architecture</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built with modern technologies for scalability and performance
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Code className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Frontend Stack</CardTitle>
                <CardDescription>
                  Modern React with Next.js for optimal performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span>Next.js 14 with App Router</span>
                    <Badge variant="success">Latest</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Better Auth React hooks</span>
                    <Badge variant="secondary">Integrated</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>TypeScript + Tailwind CSS</span>
                    <Badge variant="secondary">Type-safe</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Radix UI components</span>
                    <Badge variant="secondary">Accessible</Badge>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Authentication</CardTitle>
                <CardDescription>
                  Comprehensive auth solution with Better Auth
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span>Better Auth library</span>
                    <Badge variant="success">Core</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Email & password auth</span>
                    <Badge variant="secondary">Secure</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Session management</span>
                    <Badge variant="secondary">Persistent</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Custom Apso adapter</span>
                    <Badge variant="warning">Custom</Badge>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Database className="h-8 w-8 text-primary mb-4" />
                <CardTitle>Backend Infrastructure</CardTitle>
                <CardDescription>
                  Apso-powered backend with enterprise features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center justify-between">
                    <span>Apso-generated NestJS API</span>
                    <Badge variant="success">Generated</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>PostgreSQL database</span>
                    <Badge variant="secondary">Scalable</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>RESTful CRUD endpoints</span>
                    <Badge variant="secondary">Standard</Badge>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>TypeORM entities</span>
                    <Badge variant="secondary">ORM</Badge>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {!session && (
        <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-brand-blue/10 to-purple-500/10">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of developers who trust Better Auth + Apso for their authentication needs
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="gradient">
                <Link href="/register">
                  <Users className="w-4 h-4 mr-2" />
                  Create Your Account
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">
                  <Lock className="w-4 h-4 mr-2" />
                  Sign In
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}