import React from 'react'
export function Card({children, className}:{children:React.ReactNode, className?:string}){ return <div className={['card', className].join(' ')}>{children}</div> }
export function CardHeader({children, className}:{children:React.ReactNode, className?:string}){ return <div className={['card-header', className].join(' ')}>{children}</div> }
export function CardTitle({children, className}:{children:React.ReactNode, className?:string}){ return <div className={['card-title', className].join(' ')}>{children}</div> }
export function CardContent({children, className}:{children:React.ReactNode, className?:string}){ return <div className={['card-content', className].join(' ')}>{children}</div> }
