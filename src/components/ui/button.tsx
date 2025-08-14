import React from 'react'
import clsx from 'clsx'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'outline'|'secondary'|'destructive', size?: 'sm'|'default'|'icon' }
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Btn({ variant='default', size='default', className, children, ...props }, ref){
  const v = variant==='default'?'btn btn-default': variant==='outline'?'btn btn-outline': variant==='secondary'?'btn btn-outline': variant==='destructive'?'btn btn-outline bg-red-600 text-white border-red-600 hover:bg-red-700':'btn'
  const s = size==='sm'?' text-xs px-2 py-1.5 rounded-xl': size==='icon'?' h-8 w-8 p-0 rounded-xl':' rounded-2xl'
  return <button ref={ref} className={clsx(v, s, className)} {...props}>{children}</button>
})
export default Button
