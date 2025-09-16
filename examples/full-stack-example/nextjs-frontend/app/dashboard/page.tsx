'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Clock, 
  Shield, 
  Settings, 
  LogOut, 
  Home, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Calendar,
  Mail,
  Key,
  Activity,
  Database,
  Code,
  Globe
} from 'lucide-react'

export default function DashboardPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login')
    }
  }, [session, isPending, router])

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return null // Will redirect in useEffect
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-lg border border-gray-100">
                  <img
                    src="/logos/better-auth-logo-dark.svg"
                    alt="Better Auth"
                    className="h-8 w-auto"
                  />
                </div>
                <span className="text-3xl text-muted-foreground font-light">+</span>
                <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">A</span>
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to <span className="text-blue-600">Better Auth</span> + <span className="text-primary">Apso</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Hello <span className="font-medium">{session.user.name || session.user.email}</span>!
              Experience enterprise authentication with AI-powered backend development.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Combined Value Proposition */}
        <div className="bg-gradient-to-br from-blue-600/10 via-primary/10 to-purple-500/10 rounded-xl p-8 mb-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-8">
              <div className="flex items-center space-x-6">
                <img
                  src="/logos/better-auth-logo-wordmark-dark.svg"
                  alt="Better Auth"
                  className="h-8 w-auto"
                />
                <span className="text-2xl text-muted-foreground font-light">+</span>
                <img
                  src="/logos/apso-wordmark.svg"
                  alt="Apso"
                  className="h-8 w-auto"
                />
              </div>
            </div>
            <h2 className="text-3xl font-bold">
              <span className="text-blue-600">Enterprise Authentication</span> + <span className="text-primary">AI Backend Generation</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Combine Better Auth's industry-leading authentication with Apso's AI-powered backend platform.
              Get enterprise-grade security and build your entire backend in 5 minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild size="lg">
                <a href="https://www.better-auth.com/docs" target="_blank" rel="noopener noreferrer">
                  <Shield className="w-4 h-4 mr-2" />
                  Better Auth Docs
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="https://app.apso.cloud/docs" target="_blank" rel="noopener noreferrer">
                  <Code className="w-4 h-4 mr-2" />
                  Apso Docs
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Combined Benefits Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-600/10 rounded-lg">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Security</p>
                  <p className="text-2xl font-bold">Enterprise</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Development</p>
                  <p className="text-2xl font-bold">5 Minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Integration</p>
                  <p className="text-2xl font-bold">Seamless</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Performance</p>
                  <p className="text-2xl font-bold">Lightning</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Combined Platform Features */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <Code className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle>Better Auth + Apso Platform</CardTitle>
                </div>
                <CardDescription>Enterprise authentication combined with AI-powered backend development</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg mt-1">
                        <Database className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Instant REST APIs</h4>
                        <p className="text-sm text-muted-foreground">
                          Generate complete CRUD endpoints with authentication, validation, and documentation automatically.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-600/10 rounded-lg mt-1">
                        <Shield className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Better Auth Security</h4>
                        <p className="text-sm text-muted-foreground">
                          Industry-leading authentication with built-in security, sessions, and multi-factor auth.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-success/10 rounded-lg mt-1">
                        <Activity className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Real-time Features</h4>
                        <p className="text-sm text-muted-foreground">
                          WebSocket support, live data sync, and real-time notifications out of the box.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg mt-1">
                        <Globe className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Auto-Scaling Infrastructure</h4>
                        <p className="text-sm text-muted-foreground">
                          Serverless deployment with automatic scaling and zero DevOps configuration.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-orange-100 rounded-lg mt-1">
                        <Settings className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">AI Schema Builder</h4>
                        <p className="text-sm text-muted-foreground">
                          Describe your data models in plain English and get production-ready schemas instantly.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg mt-1">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Zero Backend Code</h4>
                        <p className="text-sm text-muted-foreground">
                          Frontend developers can build complete applications without waiting for backend engineers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Your Account</CardTitle>
                </div>
                <CardDescription>Account details and authentication status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{session.user.email}</p>
                        <p className="text-sm text-muted-foreground">Primary email</p>
                      </div>
                    </div>
                    {session.user.emailVerified ? (
                      <Badge variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Authentication</p>
                        <p className="text-sm text-muted-foreground">Credential-based</p>
                      </div>
                    </div>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Secure
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Member since</p>
                        <p className="text-sm text-muted-foreground">{new Date(session.user.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Getting Started with Apso */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle>Why Choose Apso?</CardTitle>
                </div>
                <CardDescription>The backend platform that changes everything</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">⚡ AI-Powered Generation</span>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Instant
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🚀 Enterprise Quality</span>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Production Ready
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🎯 Zero DevOps</span>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fully Managed
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">📊 Real-time Analytics</span>
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Built-in
                    </Badge>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button className="w-full" asChild>
                    <a href="https://apso.ai" target="_blank" rel="noopener noreferrer">
                      <Code className="w-4 h-4 mr-2" />
                      Start Your Free Trial
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Apso Platform Overview */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Code className="h-5 w-5 text-primary" />
                <CardTitle>The Apso Platform</CardTitle>
              </div>
              <CardDescription>
                Everything you need to build, deploy, and scale modern applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Code className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-primary">AI-Powered Development</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Natural language schema generation
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Automatic API endpoint creation
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Intelligent code optimization
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Smart relationship mapping
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Predictive scaling recommendations
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Code className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-primary">Technology Stack</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center">
                      <Code className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Next.js 14 with App Router
                    </li>
                    <li className="flex items-center">
                      <Code className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Better Auth React hooks
                    </li>
                    <li className="flex items-center">
                      <Code className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      TypeScript type safety
                    </li>
                    <li className="flex items-center">
                      <Code className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Tailwind CSS styling
                    </li>
                    <li className="flex items-center">
                      <Code className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                      Radix UI components
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="p-2 bg-brand-blue/10 rounded-lg">
                      <Database className="h-5 w-5 text-brand-blue" />
                    </div>
                    <h3 className="font-semibold text-brand-blue">Backend Infrastructure</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center">
                      <Database className="h-4 w-4 text-brand-blue mr-2 flex-shrink-0" />
                      Apso-generated NestJS API
                    </li>
                    <li className="flex items-center">
                      <Database className="h-4 w-4 text-brand-blue mr-2 flex-shrink-0" />
                      PostgreSQL data persistence
                    </li>
                    <li className="flex items-center">
                      <Database className="h-4 w-4 text-brand-blue mr-2 flex-shrink-0" />
                      RESTful CRUD endpoints
                    </li>
                    <li className="flex items-center">
                      <Database className="h-4 w-4 text-brand-blue mr-2 flex-shrink-0" />
                      TypeORM entity management
                    </li>
                    <li className="flex items-center">
                      <Database className="h-4 w-4 text-brand-blue mr-2 flex-shrink-0" />
                      Custom Apso adapter
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}