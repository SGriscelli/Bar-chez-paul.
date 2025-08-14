import type React from "react";
export const Table = ({ children }: { children: React.ReactNode }) => (
	<table className="table">{children}</table>
);
export const TableHeader = ({ children }: { children: React.ReactNode }) => (
	<thead>{children}</thead>
);
export const TableBody = ({ children }: { children: React.ReactNode }) => (
	<tbody>{children}</tbody>
);
export const TableRow = ({ children }: { children: React.ReactNode }) => (
	<tr>{children}</tr>
);
export const TableHead = ({ children }: { children: React.ReactNode }) => (
	<th className="text-left">{children}</th>
);
export const TableCell = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => <td className={className}>{children}</td>;
