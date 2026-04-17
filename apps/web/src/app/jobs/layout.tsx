import type { ReactNode } from 'react'
import PortalShell from '@/app/_components/PortalShell'

export default function JobsLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>
}
