import type React from "react";
export function Dialog({
	open,
	onOpenChange,
	children,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	children: React.ReactNode;
}) {
	if (!open) return null;
	return (
		<div className="dialog-backdrop" onClick={() => onOpenChange(false)}>
			{children}
		</div>
	);
}
export function DialogContent({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={["dialog-panel", className].filter(Boolean).join(" ")}
			onClick={(e) => e.stopPropagation()}
		>
			{children}
		</div>
	);
}
export function DialogHeader({ children }: { children: React.ReactNode }) {
	return <div className="p-4 border-b">{children}</div>;
}
export function DialogTitle({ children }: { children: React.ReactNode }) {
	return <div className="text-lg font-semibold">{children}</div>;
}
export function DialogFooter({ children }: { children: React.ReactNode }) {
	return <div className="p-4 border-t flex gap-2 justify-end">{children}</div>;
}
