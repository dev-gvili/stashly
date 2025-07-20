import React from 'react'
// import { useAutoAnimate } from '@formkit/auto-animate/react'
// import { useLocation } from 'react-router'

function Grid({ children }: { children: React.ReactNode }) {
	// const [animationParent] = useAutoAnimate({ duration: 500 })
	return (
		<div className="gap-2 pb-10 grid grid-cols-[repeat(auto-fill,_minmax(16rem,_1fr))] auto-rows-min">
			{children}
		</div>
	)
}

export { Grid }
