export default class TrTaxProviderService {
    static identifier = "tr-tax"

    async getTaxLines(
        item: any,
        calculationContext: any,
        taxRates: any[]
    ): Promise<any[]> {
        return taxRates.map(rate => ({
            id: `tax_${rate.id}`,
            rate_id: rate.id,
            rate: rate.rate || 20,
            code: rate.code || "VAT",
            name: rate.name || "KDV",
            created_at: new Date(),
            updated_at: new Date()
        }))
    }
}
