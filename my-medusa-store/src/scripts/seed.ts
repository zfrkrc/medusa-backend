import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
  const regionModuleService = container.resolve(Modules.REGION);
  const pricingModuleService = container.resolve(Modules.PRICING);
  const taxModuleService = container.resolve(Modules.TAX);
  const productModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Türkiye mağaza verileri ekleniyor...");

  // 1. Create Default Sales Channel
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Türkiye Mağazası",
  });

  if (!defaultSalesChannel.length) {
    defaultSalesChannel = await salesChannelModuleService.createSalesChannels([
      {
        name: "Türkiye Mağazası",
        description: "Türkiye pazarı için varsayılan satış kanalı",
      },
    ]);
  }

  const scId = defaultSalesChannel[0].id;
  logger.info(`Satış Kanalı ID: ${scId}`);

  // 2. Create Stock Location
  let stockLocation = await stockLocationModuleService.listStockLocations({
    name: "İstanbul Depo",
  });

  if (!stockLocation.length) {
    stockLocation = await stockLocationModuleService.createStockLocations([
      {
        name: "İstanbul Depo",
        address: {
          city: "İstanbul",
          country_code: "TR",
          address_1: "Merkez Mah. No:1",
        },
      },
    ]);
  }
  const slId = stockLocation[0].id;
  logger.info(`Stok Konumu ID: ${slId}`);

  // 3. Link Sales Channel to Stock Location
  await link.create({
    [Modules.SALES_CHANNEL]: {
      sales_channel_id: scId,
    },
    [Modules.STOCK_LOCATION]: {
      stock_location_id: slId,
    },
  });
  logger.info("Satış kanalı stok konumuna bağlandı.");

  // 4. Update Store with Default Sales Channel
  const [store] = await storeModuleService.listStores();
  await storeModuleService.updateStores(store.id, {
    default_sales_channel_id: scId,
    default_location_id: slId,
    supported_currencies: [
      { currency_code: "try", is_default: true },
      { currency_code: "usd" }
    ],
  });

  // 5. Create Region
  let regions = await regionModuleService.listRegions({
    currency_code: "try"
  });

  if (!regions.length) {
    regions = await regionModuleService.createRegions([
      {
        name: "Türkiye",
        currency_code: "try",
        countries: ["tr"],
        automatic_taxes: true
      }
    ]);
  }
  const regionId = regions[0].id;

  // 7. Create a Dummy Product
  const [product] = await productModuleService.createProducts([
    {
      title: "Medusa T-Shirt",
      handle: "t-shirt",
      status: "published",
      options: [
        { title: "Beden", values: ["S", "M", "L", "XL"] }
      ],
      variants: [
        { title: "S", options: { Beden: "S" } },
        { title: "M", options: { Beden: "M" } }
      ]
    }
  ]);

  // Link Product to Sales Channel
  await link.create({
    [Modules.PRODUCT]: { product_id: product.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: scId }
  });

  // Create Price for Product
  await pricingModuleService.createPriceSets([
    {
      prices: [
        { amount: 45000, currency_code: "try" }, // 450.00 TL
        { amount: 1500, currency_code: "usd" }
      ]
    }
  ]);

  logger.info("Türkiye için veri yükleme başarıyla tamamlandı.");
}
