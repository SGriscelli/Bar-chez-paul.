import React from 'react'
type Opt = { value: string, label: string }
export function Select({value, onValueChange, children}:{value?:string, onValueChange?:(v:string)=>void, children:React.ReactNode}){
  return <div>{children}</div>
}
export function SelectTrigger({children}:{children:React.ReactNode}){ return <div className="select">{children}</div> }
export function SelectContent({children}:{children:React.ReactNode}){ return <div className="mt-2 space-y-1">{children}</div> }
export function SelectItem({value, children, onSelect}:{value:string, children:React.ReactNode, onSelect?:(v:string)=>void}){
  return <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200" onClick={()=>onSelect?.(value)}>{children}</button>
}
export function SelectValue(){ return <span/> }
