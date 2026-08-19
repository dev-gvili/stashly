// Public surface of the overview. `routes/stash/home.tsx` renders `OverviewView`;
// everything it composes is reached by relative import from `overview-view.tsx`,
// so re-exporting the parts here only created a second, unused path to them.
export { OverviewView } from './overview-view'
export type { OverviewViewProps } from './types'
