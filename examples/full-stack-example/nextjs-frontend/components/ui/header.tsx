'use client'

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const Header = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <header
    ref={ref}
    className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}
    {...props}
  />
))
Header.displayName = "Header"

const HeaderContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("container flex h-14 items-center", className)}
    {...props}
  />
))
HeaderContainer.displayName = "HeaderContainer"

const HeaderLogo = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center space-x-2", className)}
    {...props}
  />
))
HeaderLogo.displayName = "HeaderLogo"

const HeaderNav = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    className={cn("flex items-center space-x-6 text-sm font-medium", className)}
    {...props}
  />
))
HeaderNav.displayName = "HeaderNav"

const HeaderActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-1 items-center justify-end space-x-2", className)}
    {...props}
  />
))
HeaderActions.displayName = "HeaderActions"

export { Header, HeaderContainer, HeaderLogo, HeaderNav, HeaderActions }