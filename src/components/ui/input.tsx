import React from 'react'
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={['input', props.className].filter(Boolean).join(' ')} />
}
export default Input
