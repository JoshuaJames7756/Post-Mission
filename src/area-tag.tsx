import './area-tag.css'
import { areaTone } from './area-colors.js'

export function AreaTag({ name }: { name: string }) {
  return <span className={`area-tag area-tag-${areaTone(name)}`}>{name}</span>
}
