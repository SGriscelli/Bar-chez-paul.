import React from 'react'
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <textarea {...props} className={['textarea', props.className].filter(Boolean).join(' ')} />
}
