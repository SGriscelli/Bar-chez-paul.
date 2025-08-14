import React from 'react'
export function Label({children, className}:{children:React.ReactNode, className?:string}){
  return <label className={['block text-xs font-medium text-slate-600 mb-1', className].filter(Boolean).join(' ')}>{children}</label>
}
export default Label
