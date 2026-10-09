// Amounts in this app are Indonesian rupiah. One formatter so every screen
// writes them the same way: "Rp 800.000".
const idr = new Intl.NumberFormat('id-ID')

export function formatRupiah(amount: number): string {
  return `Rp ${idr.format(amount)}`
}
