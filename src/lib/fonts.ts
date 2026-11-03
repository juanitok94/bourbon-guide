import { Fraunces, Inter } from 'next/font/google'

// Display serif for headings, clean sans for body. Both self-hosted at build time by next/font.
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const fontVars = `${fraunces.variable} ${inter.variable}`
