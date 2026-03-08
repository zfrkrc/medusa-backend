// ============================================================
// Medusa Turkey — Shipping Integration Public API
//
// Bu dosya ileride npm paket entry point'i olur:
//   import { ShippingProvider, BaseShippingProvider } from "@medusa-tr/shipping"
// ============================================================

export type {
  TurkishAddress,
  ShippingPackage,
  ShippingParty,
  ShippingPaymentType,
  CreateShipmentInput,
  ShipmentResult,
  CancelShipmentResult,
  TrackingStatus,
  TrackingEvent,
  TrackingInfo,
  LabelResult,
  RateCalculationInput,
  RateResult,
  ShippingProvider,
  ShippingProviderConfig,
  ShippingModuleOptions,
} from "./types"

export { BaseShippingProvider } from "./base-provider"
