import type { ReactNode } from 'react'
import PortalShell from '@/app/_components/PortalShell'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>
}
