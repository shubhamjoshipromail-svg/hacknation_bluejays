import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Provider } from "./domain.js";
import { mutate, store } from "./store.js";

const Registration = Provider.pick({ name: true, phoneNumber: true, locationLabel: true })
  .extend({
    jurisdiction: z.literal("NC"),
    consentSource: z.string().min(3),
    consentCapturedAt: z.string().datetime(),
    consentExpiresAt: z.string().datetime().nullable().default(null),
    consentEvidenceRef: z.string().min(3),
  });

export function registerOptedInProvider(input: unknown) {
  const value = Registration.parse(input);
  const provider = Provider.parse({
    providerId: `provider_${randomUUID()}`,
    name: value.name,
    phoneNumber: value.phoneNumber,
    locationLabel: value.locationLabel,
    source: "CONSENT_REGISTRY",
    verified: true,
    doNotCall: false,
    consent: {
      status: "OPTED_IN",
      jurisdiction: value.jurisdiction,
      source: value.consentSource,
      capturedAt: value.consentCapturedAt,
      expiresAt: value.consentExpiresAt,
      evidenceRef: value.consentEvidenceRef,
    },
  });
  return mutate((state) => {
    const duplicate = state.providerRegistry.find((item) => item.phoneNumber === provider.phoneNumber);
    if (duplicate) throw new Error("provider phone number already registered");
    state.providerRegistry.push(provider);
    return structuredClone(provider);
  });
}

export function revokeProviderConsent(providerId: string, reason: string) {
  if (!reason.trim()) throw new Error("revocation reason is required");
  return mutate((state) => {
    const provider = state.providerRegistry.find((item) => item.providerId === providerId);
    if (!provider) throw new Error("provider not found");
    provider.doNotCall = true;
    if (provider.consent) provider.consent.status = "REVOKED";
    return structuredClone(provider);
  });
}

export function eligibleRealProviders(now = new Date()) {
  return store.providerRegistry.filter((provider) => {
    const consent = provider.consent;
    return provider.source === "CONSENT_REGISTRY" && provider.verified && !provider.doNotCall && consent?.status === "OPTED_IN" && consent.jurisdiction === "NC" && (!consent.expiresAt || new Date(consent.expiresAt) > now);
  });
}

export function assertRealProviderEligible(providerId: string, now = new Date()) {
  const provider = store.providerRegistry.find((item) => item.providerId === providerId);
  if (!provider || !eligibleRealProviders(now).some((item) => item.providerId === providerId))
    throw new Error("real call blocked: active North Carolina provider opt-in evidence is required");
  return provider;
}
