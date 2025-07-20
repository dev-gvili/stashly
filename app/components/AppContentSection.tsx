interface ContentSectionProps {
	label: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
}

const ContentSection = ({ children, label, actions }: ContentSectionProps) => {
	return (
		<div className="mb-6 space-y-3">
			<section className="grid grid-cols-2">
				<h2 className="text-lg font-semibold font-serif text-foreground">
					{label}
				</h2>
				<div className="flex items-center gap-x-2 place-self-end">
					{actions}
				</div>
			</section>
			{children}
		</div>
	);
};

export { ContentSection };
