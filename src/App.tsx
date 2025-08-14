import {
	AlertTriangle,
	ArrowUpDown,
	ChevronDown,
	FileText,
	Minus,
	Package,
	Plus,
	Printer,
	RotateCcw,
	Search,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

/** ================== Types ================== */
type Product = {
	id: string;
	name: string;
	brand?: string;
	unit: string; // ex: bouteille, carton, fût
	sku?: string;
	stock: number;
	floor: number; // seuil plancher (alertes)
	orderMultiple: number;
	unitPrice?: number; // HT
	printQty: number; // quantité voulue pour facture
	image?: string; // ✅ URL ou DataURL de l'image
};

type InvoiceLine = {
	id: string;
	productId?: string; // vide => ligne libre (sauf en mode vierge/catalogue)
	label: string;
	qty: number;
	unit: string;
	unitPrice?: number; // HT
};

type Invoice = {
	id: string;
	type: "restock" | "sale" | "blank";
	date: string;
	lines: InvoiceLine[];
	notes?: string;
	affectsStock: boolean;
};

type SortKey =
	| "name"
	| "brand"
	| "unitPrice"
	| "stock"
	| "floor"
	| "orderMultiple"
	| "printQty";
type SortDir = "asc" | "desc";

/** ================== Utils ================== */
const uid = () => Math.random().toString(36).slice(2, 9);
function save<T>(key: string, value: T) {
	localStorage.setItem(key, JSON.stringify(value));
}
function load<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}
function formatCurrency(n?: number) {
	if (n == null) return "—";
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
	}).format(n);
}
const PLACEHOLDER =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>
      <rect width='100%' height='100%' fill='#f1f5f9'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#94a3b8' font-family='sans-serif' font-size='22'>Aucune image</text>
    </svg>`,
	);

// supprime accents + lowercase
const fold = (s?: string) =>
	(s || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ================== App ================== */
export default function App() {
	const [tab, setTab] = useState<"stock" | "invoices">("stock");

	// charge + rétro-compat (injecte printQty=0 si absent)
	const [products, setProducts] = useState<Product[]>(() => {
		const arr = load<Product[]>("bar_products", []);
		return arr.map((p) => ({ printQty: 0, ...p }));
	});
	const [invoices, setInvoices] = useState<Invoice[]>(() =>
		load<Invoice[]>("bar_invoices", []),
	);

	useEffect(() => save("bar_products", products), [products]);
	useEffect(() => save("bar_invoices", invoices), [invoices]);

	// Affichage: grille (cartes) ou tableau
	const [viewGrid, setViewGrid] = useState(true);

	// Tri
	const [sortBy, setSortBy] = useState<SortKey>("name");
	const [sortDir, setSortDir] = useState<SortDir>("asc");

	// Recherche dynamique
	const [searchTerm, setSearchTerm] = useState("");
	const searchRef = useRef<HTMLInputElement | null>(null);

	// Option: afficher SKU ?
	const [showSku, setShowSku] = useState<boolean>(() =>
		load("bar_showSku", false),
	);
	useEffect(() => save("bar_showSku", showSku), [showSku]);

	// Menu alertes seuil plancher
	const [showLowPanel, setShowLowPanel] = useState(false);

	// Bouton de réinitialisation (confirmation)
	const [resetAllOpen, setResetAllOpen] = useState(false);

	// Modales
	const [productModalOpen, setProductModalOpen] = useState(false);
	const [editingProduct, setEditingProduct] = useState<Product | null>(null);
	const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
	const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

	const lowStock = useMemo(
		() => products.filter((p) => p.stock < p.floor),
		[products],
	);

	// Raccourcis clavier: "/" focus, "Escape" clear
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tag = (target?.tagName || "").toLowerCase();
			const isTyping =
				tag === "input" ||
				tag === "textarea" ||
				(target as any)?.isContentEditable;
			if (e.key === "/" && !isTyping) {
				e.preventDefault();
				searchRef.current?.focus();
			}
			if (e.key === "Escape" && searchTerm) {
				setSearchTerm("");
				searchRef.current?.blur();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [searchTerm]);

	/** ---------- Tri + Recherche: produits affichés ---------- */
	const sortedProducts = useMemo(() => {
		const term = fold(searchTerm);
		const normalize = (s?: string) => (s || "").trim().toLocaleLowerCase();

		const filtered = [...products].filter((p) => {
			if (!term) return true;
			return (
				fold(p.name).includes(term) ||
				fold(p.brand).includes(term) ||
				(showSku && fold(p.sku).includes(term))
			);
		});

		filtered.sort((a, b) => {
			const cmpNums = (av?: number, bv?: number) => {
				const aOk = Number.isFinite(av as number);
				const bOk = Number.isFinite(bv as number);
				if (!aOk && !bOk) return 0;
				if (!aOk) return 1;
				if (!bOk) return -1;
				const base = (av as number) - (bv as number);
				return sortDir === "asc" ? base : -base;
			};

			if (sortBy === "name") {
				const base = normalize(a.name).localeCompare(normalize(b.name), "fr");
				return (
					(sortDir === "asc" ? base : -base) ||
					normalize(a.brand).localeCompare(normalize(b.brand), "fr")
				);
			}
			if (sortBy === "brand") {
				const base =
					normalize(a.brand).localeCompare(normalize(b.brand), "fr") ||
					normalize(a.name).localeCompare(normalize(b.name), "fr");
				return sortDir === "asc" ? base : -base;
			}
			if (sortBy === "unitPrice") return cmpNums(a.unitPrice, b.unitPrice);
			if (sortBy === "stock") return cmpNums(a.stock, b.stock);
			if (sortBy === "floor") return cmpNums(a.floor, b.floor);
			if (sortBy === "orderMultiple")
				return cmpNums(a.orderMultiple, b.orderMultiple);
			if (sortBy === "printQty") return cmpNums(a.printQty, b.printQty);
			return 0;
		});

		return filtered;
	}, [products, sortBy, sortDir, searchTerm, showSku]);

	const visibleCount = sortedProducts.length;

	// Surlignage des matches dans UI
	const markRegex = useMemo(() => {
		const t = searchTerm.trim();
		if (!t) return null;
		try {
			return new RegExp(`(${escapeRegExp(t)})`, "gi");
		} catch {
			return null;
		}
	}, [searchTerm]);

	const highlight = (text?: string) => {
		const s = text || "";
		if (!markRegex) return s;
		const parts = s.split(markRegex);
		return parts.map((part, i) =>
			i % 2 === 1 ? (
				<mark key={i} className="bg-yellow-200 px-0.5 rounded">
					{part}
				</mark>
			) : (
				<React.Fragment key={i}>{part}</React.Fragment>
			),
		);
	};

	/** ---------- Produits ---------- */
	const openNewProduct = () => {
		setEditingProduct({
			id: uid(),
			name: "",
			brand: "",
			unit: "Bouteille",
			sku: "",
			stock: 0,
			floor: 0,
			orderMultiple: 1,
			unitPrice: undefined,
			printQty: 0,
			image: "",
		});
		setProductModalOpen(true);
	};

	const saveProduct = (p: Product) => {
		const normalized: Product = {
			...p,
			printQty: Number.isFinite(p.printQty as number) ? Number(p.printQty) : 0,
		};
		setProducts((prev) =>
			prev.some((x) => x.id === p.id)
				? prev.map((x) => (x.id === p.id ? normalized : x))
				: [...prev, normalized],
		);
		setProductModalOpen(false);
		setEditingProduct(null);
	};

	const deleteProduct = (id: string) =>
		setProducts((prev) => prev.filter((p) => p.id !== id));
	const inc = (id: string, by = 1) =>
		setProducts((prev) =>
			prev.map((p) =>
				p.id === id ? { ...p, stock: Math.max(0, p.stock + by) } : p,
			),
		);
	const dec = (id: string, by = 1) =>
		setProducts((prev) =>
			prev.map((p) =>
				p.id === id ? { ...p, stock: Math.max(0, p.stock - by) } : p,
			),
		);

	/** ---------- Factures ---------- */
	const openInvoiceEditor = (inv: Invoice) => {
		setEditingInvoice(inv);
		setInvoiceModalOpen(true);
	};
	const saveInvoice = (inv: Invoice) => {
		setInvoices((prev) =>
			prev.some((x) => x.id === inv.id)
				? prev.map((x) => (x.id === inv.id ? inv : x))
				: [inv, ...prev],
		);
		setInvoiceModalOpen(false);
		setEditingInvoice(null);
	};
	const deleteInvoice = (id: string) =>
		setInvoices((prev) => prev.filter((i) => i.id !== id));
	const imageInputRef = useRef<HTMLInputElement | null>(null);

	const handleImageFileChangeInModal = (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			setEditingProduct((prev) => (prev ? { ...prev, image: dataUrl } : prev));
		};
		reader.readAsDataURL(file);
	};

	const applyInvoiceToStock = (inv: Invoice) => {
		if (!inv.affectsStock) return;
		setProducts((prev) => {
			const copy = [...prev];
			for (const line of inv.lines) {
				if (!line.productId) continue;
				const idx = copy.findIndex((p) => p.id === line.productId);
				if (idx === -1) continue;
				const delta = inv.type === "restock" ? line.qty : -line.qty;
				copy[idx] = {
					...copy[idx],
					stock: Math.max(0, copy[idx].stock + delta),
				};
			}
			return copy;
		});
	};

	// Générer facture depuis CRUD : uniquement les produits avec "Qté voulue (facture)" > 0
	const generateFromConfiguredQuantities = () => {
		const lines: InvoiceLine[] = [];
		for (const p of products) {
			const qty = Number(p.printQty || 0);
			if (qty > 0) {
				lines.push({
					id: uid(),
					productId: p.id,
					label: `${p.brand ? p.brand + " " : ""}${p.name}`,
					qty,
					unit: p.unit,
					unitPrice: p.unitPrice,
				});
			}
		}
		if (lines.length === 0) {
			alert(
				"Aucune ligne : mets ‘Qté voulue (facture)’ > 0 pour au moins un produit.",
			);
			return;
		}
		const inv: Invoice = {
			id: uid(),
			type: "restock",
			date: new Date().toISOString(),
			lines,
			notes: "Commande basée sur la configuration (Qté voulue).",
			affectsStock: true,
		};
		openInvoiceEditor(inv);
	};

	/** ---------- Impression “demande grossiste” (classique, sans prix) ---------- */
	function printInvoice(inv: Invoice) {
		const esc = (s: string) =>
			(s || "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		const date = new Date(inv.date).toLocaleString("fr-FR", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});

		const lines = inv.lines.filter((l) => l.qty > 0);

		const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Demande grossiste - ${esc(inv.id)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
    color: #0f172a;
    font-size: 12pt;
    line-height: 1.35;
  }
  .wrap { max-width: 180mm; margin: 0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 12mm; }
  .brand h1 { font-size: 18pt; margin:0 0 2mm 0; }
  .meta { text-align:right; font-size: 10pt; color:#475569; }
  .title { font-size: 14pt; font-weight:600; margin: 0 0 6mm 0; }
  table { width:100%; border-collapse: collapse; }
  th, td { padding: 6pt 8pt; border-bottom: 1px solid #e2e8f0; }
  th { text-align:left; font-size:11pt; color:#475569; font-weight:600; }
  td.qty, th.qty { text-align:right; width: 22mm; }
  td.unit, th.unit { width: 28mm; }
  .notes { margin-top: 10mm; white-space: pre-wrap; color:#334155; }
  .footer { margin-top: 12mm; display:flex; justify-content:space-between; font-size:10pt; color:#64748b; }
  .sig { margin-top: 18mm; }
  .sig .line { margin-top: 18mm; border-top:1px solid #cbd5e1; width:70mm; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">
        <h1>Demande de réassort</h1>
        <div style="font-size:10pt;color:#475569">Bar — Gestion de stock</div>
      </div>
      <div class="meta">
        <div><strong>Réf :</strong> ${esc(inv.id)}</div>
        <div><strong>Date :</strong> ${esc(date)}</div>
        <div><strong>Type :</strong> ${inv.type === "sale" ? "Vente" : inv.type === "restock" ? "Réassort" : "Vierge"}</div>
      </div>
    </div>

    <div class="title">Articles demandés (sans prix)</div>
    <table>
      <thead>
        <tr>
          <th>Article</th>
          <th class="qty">Qté</th>
          <th class="unit">Unité</th>
        </tr>
      </thead>
      <tbody>
        ${lines
					.map(
						(l) => `
          <tr>
            <td>${esc(l.label || "")}</td>
            <td class="qty">${l.qty}</td>
            <td class="unit">${esc(l.unit || "")}</td>
          </tr>
        `,
					)
					.join("")}
      </tbody>
    </table>

    ${
			inv.notes
				? `<div class="notes"><strong>Notes :</strong>
${esc(inv.notes)}</div>`
				: ""
		}

    <div class="sig">
      <div>Signature :</div>
      <div class="line"></div>
    </div>

    <div class="footer">
      <div>Document généré automatiquement — sans prix — pour envoi au grossiste.</div>
      <div>Contact: —</div>
    </div>
  </div>
<script>
  window.onload = () => { window.print(); setTimeout(() => window.close(), 200); };
</script>
</body>
</html>`;

		const win = window.open("", "_blank");
		if (!win) {
			alert("Impossible d’ouvrir la fenêtre d’impression.");
			return;
		}
		win.document.open();
		win.document.write(html);
		win.document.close();
	}

	/** ---------- Impression compacte A4 (≈50 lignes / 1 page) ---------- */
	function printInvoiceCompact(inv: Invoice) {
		const esc = (s: string) =>
			(s || "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
		const date = new Date(inv.date).toLocaleString("fr-FR", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
		const lines = inv.lines.filter((l) => l.qty > 0);

		const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <title>Demande grossiste (compact) - ${esc(inv.id)}</title>
  <style>
    @page{size:A4;margin:10mm}
    *{box-sizing:border-box}
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#0f172a;font-size:10pt;line-height:1.25}
    .wrap{max-width:185mm;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6mm}
    .h1{font-weight:700;font-size:11pt}
    .meta{text-align:right;font-size:9pt;color:#475569}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{padding:2pt 4pt;border-bottom:1px solid #e2e8f0}
    th{text-align:left;font-size:9pt;color:#475569;font-weight:600}
    td.qty,th.qty{text-align:right;width:14mm}
    td.unit,th.unit{width:22mm}
    td.article{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    tbody{font-variant-numeric:tabular-nums}
    tbody tr{break-inside:avoid}
    .notes{margin-top:6mm;font-size:9pt;color:#334155;white-space:pre-wrap;max-height:28mm;overflow:hidden}
    .footer{margin-top:6mm;font-size:9pt;color:#64748b;display:flex;justify-content:space-between}
  </style></head><body>
  <div class="wrap">
    <div class="header"><div class="h1">Demande de réassort (compact)</div>
      <div class="meta"><div><strong>Réf:</strong> ${esc(inv.id)}</div><div><strong>Date:</strong> ${esc(date)}</div></div>
    </div>
    <table><thead><tr><th>Article</th><th class="qty">Qté</th><th class="unit">Unité</th></tr></thead>
      <tbody>
        ${lines.map((l) => `<tr><td class="article">${esc(l.label || "")}</td><td class="qty">${l.qty}</td><td class="unit">${esc(l.unit || "")}</td></tr>`).join("")}
      </tbody>
    </table>
    ${inv.notes ? `<div class="notes"><strong>Notes :</strong> ${esc(inv.notes)}</div>` : ""}
    <div class="footer"><div>Document compact — sans prix.</div><div>Signature: ____________________</div></div>
  </div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),200);};</script>
  </body></html>`;

		const win = window.open("", "_blank");
		if (!win) {
			alert("Impossible d’ouvrir la fenêtre d’impression.");
			return;
		}
		win.document.open();
		win.document.write(html);
		win.document.close();
	}

	return (
		<div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
			<header className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-2xl md:text-3xl font-bold">
						Gestion de stock — Bar
					</h1>
					<p className="text-sm text-slate-500">
						Réassort + seuil plancher + factures imprimables
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Button onClick={generateFromConfiguredQuantities}>
						<FileText className="mr-2 h-4 w-4" /> Générer commande (config)
					</Button>
					<Button
						className="btn-outline"
						onClick={() =>
							openInvoiceEditor({
								id: uid(),
								type: "blank",
								date: new Date().toISOString(),
								lines: [],
								notes: "",
								affectsStock: true,
							})
						}
					>
						<FileText className="mr-2 h-4 w-4" /> Facture vierge (catalogue)
					</Button>
				</div>
			</header>

			{/* Tabs : 2 boutons, mêmes tailles, centrés */}
			<nav className="w-full">
				<div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
					<button
						aria-pressed={tab === "stock"}
						onClick={() => setTab("stock")}
						className={`h-11 w-full rounded-lg border font-medium text-sm flex items-center justify-center gap-2
              ${
								tab === "stock"
									? "bg-slate-900 text-white border-slate-900"
									: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
							}`}
					>
						<Package className="h-4 w-4" /> Stock
					</button>

					<button
						aria-pressed={tab === "invoices"}
						onClick={() => setTab("invoices")}
						className={`h-11 w-full rounded-lg border font-medium text-sm flex items-center justify-center gap-2
              ${
								tab === "invoices"
									? "bg-slate-900 text-white border-slate-900"
									: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
							}`}
					>
						<FileText className="h-4 w-4" /> Factures
					</button>
				</div>
			</nav>

			{/* ========== STOCK ========== */}
			{tab === "stock" && (
				<Card>
					<div className="card-header flex flex-col md:flex-row md:items-center md:justify-between gap-2">
						<div className="card-title">Produits</div>
						<div className="flex flex-wrap items-center gap-3">
							{/* Barre de recherche */}
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
								<Input
									ref={searchRef}
									placeholder="Rechercher (/, Échap)…"
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10 w-56 h-10"
								/>
								{searchTerm && (
									<button
										aria-label="Effacer la recherche"
										onClick={() => setSearchTerm("")}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>
							<span className="text-xs text-slate-500">
								{visibleCount} / {products.length}
							</span>

							{/* Contrôles de tri */}
							<div className="flex items-center gap-2">
								<select
									className="select"
									value={sortBy}
									onChange={(e) => setSortBy(e.target.value as SortKey)}
								>
									<option value="name">Alphabétique (Nom)</option>
									<option value="brand">Alphabétique (Marque)</option>
									<option value="unitPrice">Prix (HT)</option>
									<option value="stock">Stock</option>
									<option value="floor">Seuil plancher</option>
									<option value="orderMultiple">Lot de commande</option>
									<option value="printQty">Qté voulue (facture)</option>
								</select>
								<Button
									className="btn-outline"
									onClick={() =>
										setSortDir((d) => (d === "asc" ? "desc" : "asc"))
									}
									title={
										sortDir === "asc" ? "Tri croissant" : "Tri décroissant"
									}
								>
									<ArrowUpDown className="mr-2 h-4 w-4" />
									{sortDir === "asc" ? "Asc" : "Desc"}
								</Button>
							</div>

							{/* Option : afficher SKU */}
							<label className="text-sm flex items-center gap-2 ml-2">
								<input
									type="checkbox"
									checked={showSku}
									onChange={(e) => setShowSku(e.target.checked)}
								/>
								Afficher SKU
							</label>

							<label className="text-sm flex items-center gap-2">
								<input
									type="checkbox"
									checked={viewGrid}
									onChange={(e) => setViewGrid(e.target.checked)}
								/>
								Affichage grille (cartes)
							</label>

							{/* Bouton réinitialiser tout */}
							<Button
								variant="destructive"
								onClick={() => setResetAllOpen(true)}
								title="Remettre tous les stocks à 0 et les lots de commande à 1"
							>
								<RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser tout
							</Button>

							<Button onClick={openNewProduct}>
								<Plus className="mr-2 h-4 w-4" />
								Ajouter un produit
							</Button>
						</div>
					</div>

					<CardContent>
						{products.length === 0 ? (
							<p className="text-sm text-slate-500">
								Aucun produit. Ajoutez-en via le bouton “Ajouter un produit”.
							</p>
						) : visibleCount === 0 ? (
							<div className="rounded-2xl border p-6 text-center text-sm text-slate-500">
								Aucun résultat pour «{" "}
								<span className="font-medium">{searchTerm}</span> ».{" "}
								<button
									className="underline ml-1"
									onClick={() => setSearchTerm("")}
								>
									Effacer la recherche
								</button>
							</div>
						) : viewGrid ? (
							// ====== GRILLE DE CARTES ======
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
								{sortedProducts.map((p) => (
									<div
										key={p.id}
										className="rounded-2xl border overflow-hidden bg-white shadow-sm"
									>
										<div className="relative aspect-[4/3] bg-slate-100">
											<img
												src={p.image || PLACEHOLDER}
												alt={p.name}
												className="absolute inset-0 h-full w-full object-contain object-center bg-white p-2"
												onError={(e) => {
													(e.currentTarget as HTMLImageElement).src =
														PLACEHOLDER;
												}}
											/>
											{p.stock < p.floor && (
												<span className="absolute top-2 left-2">
													<Badge variant="destructive">Sous seuil</Badge>
												</span>
											)}
										</div>

										<div className="p-3 sm:p-4 space-y-3">
											<div>
												<div className="text-sm text-slate-500">
													{highlight(p.brand || "")}
												</div>
												<div className="font-semibold">{highlight(p.name)}</div>
												{showSku && p.sku ? (
													<div className="text-xs text-slate-500">
														SKU: {highlight(p.sku)}
													</div>
												) : null}
											</div>

											<div className="flex items-center justify-between text-sm">
												<span className="text-slate-500">Unité</span>
												<span className="font-medium">{p.unit}</span>
											</div>

											<div className="flex items-center justify-between">
												<span className="text-sm text-slate-500">Stock</span>
												<div className="flex items-center gap-1">
													<Button
														size="icon"
														className="btn-outline"
														onClick={() => dec(p.id)}
													>
														<Minus className="h-4 w-4" />
													</Button>
													<span className="w-10 text-center">{p.stock}</span>
													<Button
														size="icon"
														className="btn-outline"
														onClick={() => inc(p.id)}
													>
														<Plus className="h-4 w-4" />
													</Button>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-2">
												<div className="text-xs text-slate-500">Seuil</div>
												<div className="text-right text-sm">{p.floor}</div>
												<div className="text-xs text-slate-500">Prix (HT)</div>
												<div className="text-right text-sm">
													{formatCurrency(p.unitPrice)}
												</div>
											</div>

											<div className="flex items-center gap-2">
												<Input
													type="number"
													className="w-28 text-right"
													value={p.printQty ?? 0}
													onChange={(e) =>
														setProducts((prev) =>
															prev.map((x) =>
																x.id === p.id
																	? {
																			...x,
																			printQty: Number(
																				(e.target as HTMLInputElement).value,
																			),
																		}
																	: x,
															),
														)
													}
												/>
												<span className="text-sm text-slate-500">
													Qté voulue (facture)
												</span>
											</div>

											<div className="flex gap-2 pt-1">
												<Button
													className="btn-outline w-full"
													onClick={() => {
														setEditingProduct(p);
														setProductModalOpen(true);
													}}
												>
													Modifier
												</Button>
												<Button
													variant="destructive"
													onClick={() => deleteProduct(p.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							// ====== TABLEAU ======
							<div className="rounded-2xl border overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Produit</TableHead>
											<TableHead>Unité</TableHead>
											<TableHead className="text-right">Stock</TableHead>
											<TableHead className="text-right">
												Seuil plancher
											</TableHead>
											<TableHead className="text-right">
												Qté voulue (facture)
											</TableHead>
											<TableHead className="text-right">Prix (HT)</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedProducts.map((p) => (
											<TableRow
												key={p.id}
												className={p.stock < p.floor ? "bg-red-50/60" : ""}
											>
												<TableCell className="font-medium">
													<div className="flex items-center gap-3">
														<img
															src={p.image || PLACEHOLDER}
															alt=""
															className="w-12 h-12 rounded-lg object-contain object-center border bg-white p-1"
														/>
														<div>
															<div>
																{p.brand ? (
																	<span>
																		{highlight(p.brand)}{" "}
																		<span className="text-slate-400">•</span>{" "}
																		{highlight(p.name)}
																	</span>
																) : (
																	highlight(p.name)
																)}
															</div>
															{showSku && p.sku ? (
																<div className="text-xs text-slate-500">
																	SKU: {highlight(p.sku)}
																</div>
															) : null}
														</div>
														{p.stock < p.floor && (
															<Badge variant="destructive">Sous seuil</Badge>
														)}
													</div>
												</TableCell>
												<TableCell>{p.unit}</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														<Button
															size="icon"
															className="btn-outline"
															onClick={() => dec(p.id)}
														>
															<Minus className="h-4 w-4" />
														</Button>
														<span className="w-10 text-center">{p.stock}</span>
														<Button
															size="icon"
															className="btn-outline"
															onClick={() => inc(p.id)}
														>
															<Plus className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
												<TableCell className="text-right">{p.floor}</TableCell>
												<TableCell className="text-right">
													<Input
														type="number"
														className="w-24 text-right"
														value={p.printQty ?? 0}
														onChange={(e) =>
															setProducts((prev) =>
																prev.map((x) =>
																	x.id === p.id
																		? {
																				...x,
																				printQty: Number(
																					(e.target as HTMLInputElement).value,
																				),
																			}
																		: x,
																),
															)
														}
													/>
												</TableCell>
												<TableCell className="text-right">
													{formatCurrency(p.unitPrice)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														<Button
															className="btn-outline"
															onClick={() => {
																setEditingProduct(p);
																setProductModalOpen(true);
															}}
														>
															Modifier
														</Button>
														<Button
															variant="destructive"
															onClick={() => deleteProduct(p.id)}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>

					{/* Alerte seuil plancher (menu déroulant discret) */}
					<div className="px-4 pb-4">
						<button
							onClick={() => setShowLowPanel((v) => !v)}
							className="w-full flex items-center justify-between rounded-xl border bg-white hover:bg-slate-50 transition px-4 py-3 text-left"
						>
							<span className="font-medium">Alerte seuil plancher</span>
							<span className="flex items-center gap-2 text-sm text-slate-600">
								<Badge variant="secondary">{lowStock.length}</Badge>
								<ChevronDown
									className={`h-4 w-4 transition-transform ${showLowPanel ? "rotate-180" : ""}`}
								/>
							</span>
						</button>

						{showLowPanel && lowStock.length > 0 && (
							<Card className="mt-3">
								<CardContent className="space-y-2 p-4">
									{lowStock.map((p) => (
										<div
											key={p.id}
											className="flex items-center justify-between text-sm"
										>
											<div>
												{p.brand ? p.brand + " • " : ""}
												{p.name}{" "}
												<span className="text-slate-500">
													(stock: {p.stock} / seuil: {p.floor})
												</span>
											</div>
											<div className="text-slate-600">
												Qté configurée: {p.printQty} {p.unit}
												{p.printQty > 0 ? "(s)" : ""}
											</div>
										</div>
									))}
								</CardContent>
							</Card>
						)}
					</div>
				</Card>
			)}

			{/* ========== FACTURES ========== */}
			{tab === "invoices" && (
				<Card>
					<div className="card-header flex flex-col md:flex-row md:items-center md:justify-between gap-2">
						<div className="card-title">Factures</div>
						<div className="flex gap-2">
							<Button
								onClick={() =>
									openInvoiceEditor({
										id: uid(),
										type: "sale",
										date: new Date().toISOString(),
										lines: [],
										notes: "",
										affectsStock: true,
									})
								}
							>
								<Plus className="mr-2 h-4 w-4" />
								Nouvelle facture (vente)
							</Button>
							<Button
								className="btn-outline"
								onClick={() =>
									openInvoiceEditor({
										id: uid(),
										type: "blank",
										date: new Date().toISOString(),
										lines: [],
										notes: "",
										affectsStock: true,
									})
								}
							>
								<FileText className="mr-2 h-4 w-4" />
								Facture vierge (catalogue)
							</Button>
						</div>
					</div>
					<CardContent>
						{invoices.length === 0 ? (
							<p className="text-sm text-slate-500">
								Aucune facture pour le moment.
							</p>
						) : (
							<div className="rounded-2xl border overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Date</TableHead>
											<TableHead>Type</TableHead>
											<TableHead className="text-right">Lignes</TableHead>
											<TableHead className="text-right">Total (HT)</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{invoices.map((inv) => {
											const total = inv.lines.reduce(
												(s, l) => s + (l.unitPrice ?? 0) * l.qty,
												0,
											);
											return (
												<TableRow key={inv.id}>
													<TableCell>
														{new Date(inv.date).toLocaleString("fr-FR")}
													</TableCell>
													<TableCell>
														{inv.type === "restock" && <Badge>Réassort</Badge>}
														{inv.type === "sale" && (
															<Badge variant="secondary">Vente</Badge>
														)}
														{inv.type === "blank" && (
															<Badge variant="outline">
																Vierge (catalogue)
															</Badge>
														)}
													</TableCell>
													<TableCell className="text-right">
														{inv.lines.length}
													</TableCell>
													<TableCell className="text-right">
														{formatCurrency(total)}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															<Button
																className="btn-outline"
																onClick={() => openInvoiceEditor(inv)}
															>
																Ouvrir
															</Button>
															<Button
																variant="destructive"
																onClick={() => deleteInvoice(inv.id)}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* ---------- Modale Produit ---------- */}
			<Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingProduct &&
							products.some((p) => p.id === editingProduct.id)
								? "Modifier le produit"
								: "Nouveau produit"}
						</DialogTitle>
					</DialogHeader>

					{editingProduct && (
						<div className="grid grid-cols-2 gap-3 p-4">
							<div className="col-span-2">
								<Label>Nom</Label>
								<Input
									value={editingProduct.name}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											name: (e.target as HTMLInputElement).value,
										})
									}
								/>
							</div>

							<div>
								<Label>Marque</Label>
								<Input
									value={editingProduct.brand || ""}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											brand: (e.target as HTMLInputElement).value,
										})
									}
								/>
							</div>

							<div>
								<Label>Unité</Label>
								<Input
									value={editingProduct.unit}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											unit: (e.target as HTMLInputElement).value,
										})
									}
								/>
							</div>

							{/* === Upload / Drag&Drop === */}
							<div className="col-span-2">
								<Label>Image</Label>
								<div
									className="mt-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 transition"
									onClick={() => imageInputRef.current?.click()}
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => {
										e.preventDefault();
										const file = e.dataTransfer.files?.[0];
										if (file) {
											const reader = new FileReader();
											reader.onload = () =>
												setEditingProduct({
													...editingProduct,
													image: reader.result as string,
												});
											reader.readAsDataURL(file);
										}
									}}
								>
									{editingProduct.image ? (
										<img
											src={editingProduct.image}
											alt="aperçu"
											className="w-full h-40 object-contain object-center rounded-lg border bg-white p-2"
										/>
									) : (
										<>
											<Upload className="w-6 h-6 text-slate-400" />
											<span className="text-sm text-slate-500">
												Glisser-déposer ou cliquer pour choisir une image
											</span>
										</>
									)}
								</div>
								<input
									type="file"
									accept="image/*"
									ref={imageInputRef}
									onChange={handleImageFileChangeInModal}
									className="hidden"
								/>
								{editingProduct.image && (
									<Button
										variant="destructive"
										size="sm"
										className="mt-2"
										onClick={() =>
											setEditingProduct({ ...editingProduct, image: "" })
										}
									>
										Supprimer l'image
									</Button>
								)}
							</div>

							{/* Suite des champs */}
							{showSku && (
								<div>
									<Label>SKU (optionnel)</Label>
									<Input
										value={editingProduct.sku || ""}
										onChange={(e) =>
											setEditingProduct({
												...editingProduct,
												sku: (e.target as HTMLInputElement).value,
											})
										}
									/>
								</div>
							)}
							<div>
								<Label>Stock actuel</Label>
								<Input
									type="number"
									value={editingProduct.stock}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											stock: Number((e.target as HTMLInputElement).value),
										})
									}
								/>
							</div>
							<div>
								<Label>Seuil plancher</Label>
								<Input
									type="number"
									value={editingProduct.floor}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											floor: Number((e.target as HTMLInputElement).value),
										})
									}
								/>
							</div>
							<div>
								<Label>Lot de commande</Label>
								<Input
									type="number"
									value={editingProduct.orderMultiple}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											orderMultiple: Number(
												(e.target as HTMLInputElement).value,
											),
										})
									}
								/>
							</div>
							<div>
								<Label>Prix unitaire (HT)</Label>
								<Input
									type="number"
									value={editingProduct.unitPrice ?? 0}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											unitPrice:
												Number((e.target as HTMLInputElement).value) ||
												undefined,
										})
									}
								/>
							</div>
							<div>
								<Label>Qté voulue (facture)</Label>
								<Input
									type="number"
									value={editingProduct.printQty ?? 0}
									onChange={(e) =>
										setEditingProduct({
											...editingProduct,
											printQty: Number((e.target as HTMLInputElement).value),
										})
									}
								/>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							className="btn-outline"
							onClick={() => setProductModalOpen(false)}
						>
							Fermer
						</Button>
						{editingProduct && (
							<Button onClick={() => saveProduct(editingProduct)}>
								{products.some((p) => p.id === editingProduct.id)
									? "Enregistrer"
									: "Ajouter"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ---------- Modale Facture (vierge = uniquement produits du catalogue) ---------- */}
			<Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>
							{editingInvoice?.type === "blank"
								? "Facture vierge (catalogue seulement)"
								: editingInvoice?.type === "restock"
									? "Commande / Réassort"
									: "Facture de vente"}
						</DialogTitle>
					</DialogHeader>
					{editingInvoice && (
						<div className="space-y-4 p-4">
							<div className="grid md:grid-cols-3 gap-3">
								<div>
									<Label>Type</Label>
									<select
										className="select"
										value={editingInvoice.type}
										onChange={(e) =>
											setEditingInvoice({
												...editingInvoice,
												type: e.target.value as any,
											})
										}
									>
										<option value="sale">Vente</option>
										<option value="restock">Réassort</option>
										<option value="blank">Vierge (catalogue)</option>
									</select>
								</div>
								<div>
									<Label>Date</Label>
									<input
										className="input"
										type="datetime-local"
										value={new Date(editingInvoice.date)
											.toISOString()
											.slice(0, 16)}
										onChange={(e) =>
											setEditingInvoice({
												...editingInvoice,
												date: new Date(e.target.value).toISOString(),
											})
										}
									/>
								</div>
								<div className="flex items-end gap-2">
									<label className="inline-flex items-center gap-2 text-sm text-slate-600">
										<input
											type="checkbox"
											checked={editingInvoice.affectsStock}
											onChange={(e) =>
												setEditingInvoice({
													...editingInvoice,
													affectsStock: e.target.checked,
												})
											}
										/>
										Impacte le stock
									</label>
								</div>
							</div>

							<div className="rounded-2xl border overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead style={{ minWidth: 260 }}>Article</TableHead>
											<TableHead
												className="text-right"
												style={{ minWidth: 140 }}
											>
												Qté
											</TableHead>
											<TableHead style={{ minWidth: 120 }}>Unité</TableHead>
											<TableHead
												className="text-right"
												style={{ minWidth: 140 }}
											>
												PU (HT)
											</TableHead>
											<TableHead
												className="text-right"
												style={{ minWidth: 140 }}
											>
												Total
											</TableHead>
											<TableHead
												className="text-right"
												style={{ minWidth: 120 }}
											>
												Actions
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{editingInvoice.lines.map((l) => {
											const selectedProduct = products.find(
												(p) => p.id === l.productId,
											);
											const canFreeEdit = editingInvoice.type !== "blank"; // en vierge on choisit dans le catalogue
											return (
												<TableRow key={l.id}>
													<TableCell className="min-w-[260px]">
														{canFreeEdit ? (
															<Input
																value={l.label}
																onChange={(e) => {
																	const updated = {
																		...l,
																		label: (e.target as HTMLInputElement).value,
																	};
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.map((x) =>
																			x.id === l.id ? updated : x,
																		),
																	});
																}}
															/>
														) : (
															<select
																className="select w-full"
																value={l.productId || ""}
																onChange={(e) => {
																	const pid = e.target.value;
																	const p = products.find(
																		(pp) => pp.id === pid,
																	);
																	if (!p) return;
																	const updated: InvoiceLine = {
																		...l,
																		productId: p.id,
																		label: `${p.brand ? p.brand + " " : ""}${p.name}`,
																		unit: p.unit,
																		unitPrice: p.unitPrice,
																	};
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.map((x) =>
																			x.id === l.id ? updated : x,
																		),
																	});
																}}
															>
																<option value="" disabled>
																	Choisir un produit…
																</option>
																{products.map((p) => (
																	<option key={p.id} value={p.id}>
																		{p.brand
																			? `${p.brand} — ${p.name}`
																			: p.name}
																	</option>
																))}
															</select>
														)}
														{!canFreeEdit && selectedProduct && (
															<div className="mt-1 text-xs text-slate-500">
																Stock actuel: {selectedProduct.stock} • Seuil:{" "}
																{selectedProduct.floor}
															</div>
														)}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex items-center justify-end gap-1">
															<Button
																size="icon"
																className="btn-outline"
																onClick={() => {
																	const updated = {
																		...l,
																		qty: Math.max(0, l.qty - 1),
																	};
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.map((x) =>
																			x.id === l.id ? updated : x,
																		),
																	});
																}}
															>
																<Minus className="h-4 w-4" />
															</Button>
															<Input
																type="number"
																className="w-20 text-right"
																value={l.qty}
																onChange={(e) => {
																	const updated = {
																		...l,
																		qty: Number(
																			(e.target as HTMLInputElement).value,
																		),
																	};
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.map((x) =>
																			x.id === l.id ? updated : x,
																		),
																	});
																}}
															/>
															<Button
																size="icon"
																onClick={() => {
																	const updated = { ...l, qty: l.qty + 1 };
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.map((x) =>
																			x.id === l.id ? updated : x,
																		),
																	});
																}}
															>
																<Plus className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
													<TableCell>{l.unit}</TableCell>
													<TableCell className="text-right">
														<Input
															type="number"
															className="w-28 text-right"
															value={l.unitPrice ?? 0}
															onChange={(e) => {
																const updated = {
																	...l,
																	unitPrice:
																		Number(
																			(e.target as HTMLInputElement).value,
																		) || undefined,
																};
																setEditingInvoice({
																	...editingInvoice,
																	lines: editingInvoice.lines.map((x) =>
																		x.id === l.id ? updated : x,
																	),
																});
															}}
														/>
													</TableCell>
													<TableCell className="text-right">
														{formatCurrency((l.unitPrice ?? 0) * l.qty)}
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															<Button
																variant="destructive"
																onClick={() =>
																	setEditingInvoice({
																		...editingInvoice,
																		lines: editingInvoice.lines.filter(
																			(x) => x.id !== l.id,
																		),
																	})
																}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</TableCell>
												</TableRow>
											);
										})}
										<TableRow>
											<TableCell colSpan={6}>
												<div className="flex items-center gap-2">
													<Button
														className="btn-outline"
														onClick={() =>
															setEditingInvoice({
																...editingInvoice,
																lines: [
																	...editingInvoice.lines,
																	{
																		id: uid(),
																		label: "",
																		qty: 1,
																		unit: "unité",
																		unitPrice: 0,
																	},
																],
															})
														}
													>
														<Plus className="mr-2 h-4 w-4" />
														Ajouter une ligne
													</Button>
													<div className="text-sm text-slate-500">
														{editingInvoice.type === "blank"
															? "Choisis un produit du catalogue pour chaque ligne."
															: "Astuce : tu peux ajuster les quantités avant impression."}
													</div>
												</div>
											</TableCell>
										</TableRow>
									</TableBody>
								</Table>
							</div>

							<div className="grid md:grid-cols-2 gap-3">
								<div>
									<Label>Notes</Label>
									<Textarea
										value={editingInvoice.notes || ""}
										onChange={(e) =>
											setEditingInvoice({
												...editingInvoice,
												notes: (e.target as HTMLTextAreaElement).value,
											})
										}
									/>
								</div>
								<div className="p-4 rounded-2xl border space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-sm text-slate-500">
											Sous-total (HT)
										</span>
										<span className="font-medium">
											{formatCurrency(
												editingInvoice.lines.reduce(
													(s, l) => s + (l.unitPrice ?? 0) * l.qty,
													0,
												),
											)}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm text-slate-500">
											TVA (20% estim.)
										</span>
										<span className="font-medium">
											{formatCurrency(
												editingInvoice.lines.reduce(
													(s, l) => s + (l.unitPrice ?? 0) * l.qty,
													0,
												) * 0.2,
											)}
										</span>
									</div>
									<div className="flex items-center justify-between text-lg">
										<span className="font-semibold">Total TTC (est.)</span>
										<span className="font-bold">
											{formatCurrency(
												editingInvoice.lines.reduce(
													(s, l) => s + (l.unitPrice ?? 0) * l.qty,
													0,
												) * 1.2,
											)}
										</span>
									</div>
								</div>
							</div>

							<div className="flex flex-wrap gap-2 justify-end">
								{/* Nouveau bouton compact 1 page */}
								<Button
									className="btn-outline"
									onClick={() => printInvoiceCompact(editingInvoice!)}
								>
									<Printer className="mr-2 h-4 w-4" /> Imprimer (compact 1 page)
								</Button>

								{/* Bouton existant “demande grossiste” */}
								<Button
									className="btn-outline"
									onClick={() => printInvoice(editingInvoice!)}
								>
									<Printer className="mr-2 h-4 w-4" /> Imprimer (demande
									grossiste)
								</Button>

								<Button
									className="btn-outline"
									onClick={() => saveInvoice(editingInvoice)}
								>
									Enregistrer
								</Button>
								{editingInvoice.affectsStock && (
									<Button
										onClick={() => {
											applyInvoiceToStock(editingInvoice);
											saveInvoice(editingInvoice);
											setInvoiceModalOpen(false);
										}}
									>
										Appliquer au stock
									</Button>
								)}
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{/* ---------- Alerte Réinitialiser tout ---------- */}
			<Dialog open={resetAllOpen} onOpenChange={(v) => setResetAllOpen(v)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Réinitialiser tous les produits ?</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 p-1">
						<div className="flex items-start gap-3 text-amber-600">
							<AlertTriangle className="mt-0.5 h-5 w-5" />
							<p className="text-sm">
								Cette action remettra <strong>tous les stocks à 0</strong> et{" "}
								<strong>tous les lots de commande à 1</strong>. Elle est
								immédiate et ne peut pas être annulée.
							</p>
						</div>
						<ul className="text-sm text-slate-600 list-disc pl-5">
							<li>Stock → 0</li>
							<li>Lot de commande → 1</li>
							<li>Les autres champs ne changent pas.</li>
						</ul>
					</div>
					<DialogFooter>
						<Button
							className="btn-outline"
							onClick={() => setResetAllOpen(false)}
						>
							Annuler
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setProducts((prev) =>
									prev.map((p) => ({ ...p, stock: 0, orderMultiple: 1 })),
								);
								setResetAllOpen(false);
							}}
						>
							Oui, réinitialiser
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<div className="text-xs text-slate-500 text-center pt-8">
				Astuces: Ctrl/Cmd+P pour imprimer. Données enregistrées localement
				(localStorage).
			</div>
		</div>
	);
}
