import React from 'react'
type Variant = 'default'|'secondary'|'outline'|'destructive'
export function Badge({children, variant='default'}:{children:React.ReactNode, variant?:Variant}){
  const map: Record<Variant,string> = {
    default: 'badge badge-default',
    secondary: 'badge badge-secondary',
    outline: 'badge badge-outline',
    destructive: 'badge badge-destructive',
  }
  return <span className={map[variant]}>{children}</span>
}
