import optionBCss from '@/styles/option-b.css?url'
import OptionBDemo from '@/components/options/option-b/layout'

export const links = () => [{ rel: 'stylesheet', href: optionBCss }]

export default function OptionBRoute() {
  return (
    <div data-theme="aurora">
      <OptionBDemo />
    </div>
  )
}
