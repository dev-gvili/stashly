import optionACss from '@/styles/option-a.css?url'
import OptionADemo from '@/components/options/option-a/layout'

export const links = () => [{ rel: 'stylesheet', href: optionACss }]

export default function OptionARoute() {
  return (
    <div data-theme="obsidian">
      <OptionADemo />
    </div>
  )
}
