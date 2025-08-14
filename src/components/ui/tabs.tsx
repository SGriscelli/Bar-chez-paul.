import React from "react";
export function Tabs({
	value,
	onValueChange,
	children,
}: {
	value: string;
	onValueChange: (v: string) => void;
	children: React.ReactNode;
}) {
	return <div data-value={value}>{children}</div>;
}
export function TabsList({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={["tabs-list", className].filter(Boolean).join(" ")}>
			{children}
		</div>
	);
}
export function TabsTrigger({
	value,
	children,
}: {
	value: string;
	children: React.ReactNode;
}) {
	const [tab, setTab] = React.useState<string>("");
	return (
		<button className="tabs-trigger" data-active={false}>
			{children}
		</button>
	);
}
export function TabsContent({
	value,
	children,
	className,
}: {
	value: string;
	children: React.ReactNode;
	className?: string;
}) {
	// naive: always render, rely on parent App to control visibility
	return (
		<div className={className} data-value={value}>
			{children}
		</div>
	);
}
