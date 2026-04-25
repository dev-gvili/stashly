import optionCCss from '@/styles/option-c.css?url'
import OptionCDemo from '@/components/options/option-c/layout'

export const links = () => [{ rel: 'stylesheet', href: optionCCss }]

export default function OptionCRoute() {
  return (
    <div data-theme="paper">
      <OptionCDemo />
    </div>
  )
}
