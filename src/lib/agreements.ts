// Partner agreements: the texts partners sign before they can list.
//
// Each agreement is versioned. Changing any wording means bumping its
// `version`; partners are then asked to sign the new version before they can
// add listings again. `reviewed` stays false until the lawyer has approved
// that exact version (shown to admins only, on /admin/agreements).
//
// Pure module (no DB, no Node APIs) so pages and the PDF builder share it.

import type { PartnerTypeKey } from '@/lib/partner-requirements'

// Lawyer to confirm: the registered legal entity, RC number and address
// that contracts with partners. Shown in every agreement's opening.
export const COMPANY = {
  name: 'Lux Catalog',
  descriptor: 'the online luxury marketplace operated at luxcatalog.vercel.app and its successor domains',
  address: 'Lagos, Nigeria',
  email: 'luxurycatalog01@gmail.com',
}

export type Clause = { heading: string; paragraphs: string[] }
export type AgreementTemplate = {
  key: string
  title: string
  version: string
  reviewed: boolean
  appliesTo: 'all' | PartnerTypeKey[]
  summary: string
  clauses: Clause[]
}

export type CommissionLine = { collection: string; ratePercent: number; payout: string }

// What a rendered agreement needs to know about the partner.
export type AgreementContext = {
  partnerName: string
  businessName: string
  partnerTypeLabel: string
  commission: CommissionLine[]
}

export const PAYOUT_TIMING_TEXT: Record<string, string> = {
  after_checkin: 'paid out about 24 hours after the stay, hire or service begins',
  after_completion: 'paid out after the assignment has been completed',
  on_completion_of_sale: 'paid out once the sale or tenancy has completed',
}

const MASTER: AgreementTemplate = {
  key: 'master',
  title: 'Partner Agreement',
  version: '1.0',
  reviewed: false,
  appliesTo: 'all',
  summary: 'The main agreement between you and Lux Catalog: how listings, bookings, payments, commission and standards work.',
  clauses: [
    {
      heading: 'Who we are and what this agreement covers',
      paragraphs: [
        `This agreement is between ${COMPANY.name}, ${COMPANY.descriptor} ("Lux Catalog", "we", "us"), and {{businessName}}, represented by {{partnerName}} ("you", "the Partner").`,
        'Lux Catalog is a marketplace. We present your assets and services to our clients, take bookings and payments for them, and support both sides. You own or are authorised to offer what you list, and you are responsible for delivering it exactly as described.',
        'This agreement applies together with the schedule for your partner type ({{partnerTypeLabel}}). If the two differ, the schedule applies for matters specific to your category.',
      ],
    },
    {
      heading: 'Verification and keeping your details current',
      paragraphs: [
        'Everything you gave us in your application, and everything you add later, must be true, complete and current.',
        'You must tell us within 7 days if anything material changes: ownership, a licence or permit being suspended or expiring, insurance lapsing, or a change of directors or contact person. Upload renewed documents before the old ones expire.',
        'We may verify your documents, ask for more, and visit or inspect what you list. We may pause your listings while a check is outstanding.',
      ],
    },
    {
      heading: 'Your listings',
      paragraphs: [
        'Listings must be accurate: your own current photos, honest descriptions, real availability and the price the client will actually pay. No hidden charges.',
        'We may edit wording and presentation for clarity and our house style, choose where listings appear, and decline or remove any listing that does not meet our standard or the law.',
        'You must not list anything you are not entitled to offer, or anything unlawful.',
      ],
    },
    {
      heading: 'Bookings and payments',
      paragraphs: [
        'Clients book and pay through Lux Catalog. We collect payments on your behalf as your limited payment-collection agent, through our payment provider (currently Paystack). Once a client has paid us, their obligation to pay for that booking is met.',
        'You must not ask a client introduced by Lux Catalog to pay you directly, or add charges outside the platform.',
      ],
    },
    {
      heading: 'Commission and payouts',
      paragraphs: [
        'For each completed booking or sale, we keep our commission and pay you the rest. Your current rates and payout timing are:',
        '{{commissionSchedule}}',
        'Commission is calculated on the total the client pays for your asset or service, excluding any refundable security deposit.',
        'We may hold a payout while a complaint, refund request, chargeback or damage claim about that booking is being resolved, and may deduct from your payouts any refund or amount you owe under this agreement.',
        'You are responsible for your own taxes, including any VAT due on your services.',
        'Rates may be agreed differently for you in writing. A change in rates applies only to bookings made after it takes effect.',
      ],
    },
    {
      heading: 'Clients introduced by Lux Catalog',
      paragraphs: [
        'For 12 months after a client is introduced to you through Lux Catalog, you must not deal with that client directly, or through anyone else, for the same kind of asset or service in a way that avoids our commission.',
        'If you do, you must pay us the commission we would have earned, and we may end this agreement.',
      ],
    },
    {
      heading: 'Standards',
      paragraphs: [
        'You will be punctual, discreet, courteous, clean and exactly as listed. Our clients expect a luxury standard at every step.',
        'You will respond to booking requests and client messages promptly, and in any case within 24 hours.',
        'You will treat every client with respect and will not discriminate against anyone.',
      ],
    },
    {
      heading: 'Cancellations, refunds and complaints',
      paragraphs: [
        'Each booking follows the cancellation policy shown on the listing when the client booked.',
        'If you cancel a confirmed booking, the client is refunded in full. We may charge you a reasonable fee for finding an alternative and may lower the listing\'s ranking or pause it.',
        'If a client complains, we will hear both sides and decide in good faith on any refund or credit. You agree to cooperate and to provide evidence when we ask.',
      ],
    },
    {
      heading: 'Insurance and responsibility',
      paragraphs: [
        'You will keep the insurance required for your category (see your schedule) in force for as long as you list with us.',
        'You are responsible for your assets, your staff and contractors, and the services you provide. You agree to compensate Lux Catalog for any claim, loss or penalty caused by your breach of this agreement, your negligence, or your breaking the law.',
        'Our total liability to you under this agreement is limited to the commission we earned from your bookings in the 12 months before the claim. Nothing in this agreement limits liability for fraud, or for death or personal injury caused by negligence.',
      ],
    },
    {
      heading: 'Privacy and confidentiality',
      paragraphs: [
        'You will use client details only to deliver their booking, keep them secure, and comply with the Nigeria Data Protection Act 2023 (and the data protection laws of any other country you operate in).',
        'You will not market to clients introduced by Lux Catalog, share their details, or disclose their identity or whereabouts to anyone.',
        'You will keep the terms of this agreement and any non-public information about Lux Catalog confidential.',
      ],
    },
    {
      heading: 'Photos, content and reviews',
      paragraphs: [
        'You allow Lux Catalog to use the photos, videos and content you provide, and your business name and logo, to market your listings and Lux Catalog, for as long as you list with us and for a reasonable time after.',
        'Clients may review their experience. We publish genuine reviews and do not remove them because they are negative.',
      ],
    },
    {
      heading: 'Suspension and ending this agreement',
      paragraphs: [
        'Either of us may end this agreement with 30 days\' written notice by email.',
        'We may suspend your listings or end this agreement immediately if there is a risk to client safety, suspected fraud, a serious complaint, an expired licence, permit or insurance, or a serious breach of this agreement.',
        'Confirmed bookings made before the end date must still be honoured, unless we decide it is unsafe to do so. The clauses on payouts owed, clients introduced by Lux Catalog, responsibility and confidentiality continue after this agreement ends.',
      ],
    },
    {
      heading: 'Changes to this agreement',
      paragraphs: [
        'We may update this agreement by giving you at least 30 days\' notice by email. To keep listing after an update takes effect, you will be asked to accept the new version.',
      ],
    },
    {
      heading: 'Signing electronically',
      paragraphs: [
        'You agree that typing your full name and selecting "Sign agreement" is your signature on this agreement, with the same effect as a handwritten signature (as recognised under the Evidence Act 2011 and the Cybercrimes (Prohibition, Prevention, etc.) Act 2015).',
        'We keep a record of the exact text you signed, the date and time, your IP address and device, and email you a copy.',
      ],
    },
    {
      heading: 'Governing law and disputes',
      paragraphs: [
        'This agreement is governed by the laws of the Federal Republic of Nigeria as applied in Lagos State.',
        'If a dispute arises, we will first try in good faith to resolve it between us within 14 days. If that fails, either of us may refer it to mediation at the Lagos Multi-Door Courthouse. If mediation does not resolve it within 30 days, it will be settled by arbitration under the Arbitration and Mediation Act 2023, before a single arbitrator, seated in Lagos, in English.',
      ],
    },
    {
      heading: 'General',
      paragraphs: [
        'This agreement, its schedule and the policies it refers to are the whole agreement between us about its subject. It does not create a partnership, joint venture or employment between us.',
        'You may not transfer this agreement without our written consent. Notices are sent by email to the addresses we each have on file; ours is ' + COMPANY.email + '.',
      ],
    },
  ],
}

const SHORTLET: AgreementTemplate = {
  key: 'schedule_property',
  title: 'Schedule A: Short-let and Rental Properties',
  version: '1.0',
  reviewed: false,
  appliesTo: ['property_host'],
  summary: 'Extra terms for shortlets, long-term rentals and properties for sale.',
  clauses: [
    {
      heading: 'Authority and registration',
      paragraphs: [
        'You own each property you list or hold written authority from the owner to let or sell it, and you will show us that authority on request.',
        'You will register each short-let where state or local rules require it (including any Lagos State short-let registration), and comply with estate rules.',
      ],
    },
    {
      heading: 'Safety',
      paragraphs: [
        'Each property must have a working smoke alarm, a fire extinguisher, a first-aid kit, safe electrics and secure doors and windows.',
        'Generators must be installed outside living and sleeping areas and properly vented. Pools and balconies must be safe for the guests you accept.',
      ],
    },
    {
      heading: 'Guest experience',
      paragraphs: [
        'At every check-in the property is clean, with fresh linen and towels, and the power backup, water, air-conditioning and internet you advertise are working.',
        'House rules, check-in and check-out times, and any limits on guests, events or noise are stated on the listing. You may not add new rules after booking.',
        'If something you advertised fails during a stay and is not fixed within a reasonable time, we may refund the guest for the affected nights from your payout.',
      ],
    },
    {
      heading: 'Privacy of guests',
      paragraphs: [
        'There must be no cameras or recording devices inside the property. Any external cameras (at gates or entrances) must be disclosed on the listing.',
      ],
    },
    {
      heading: 'Deposits and damage',
      paragraphs: [
        'Security deposits are taken only through Lux Catalog. Damage claims must be made within 48 hours of check-out, with photos and receipts; we will decide them fairly after hearing the guest.',
      ],
    },
    {
      heading: 'Long-term rentals and sales',
      paragraphs: [
        'For long-term rentals and sales, our fee is as set out in the commission schedule and is due when the tenancy or sale completes. You will not charge clients introduced by us any agency or legal fee beyond what the law allows.',
      ],
    },
  ],
}

const VEHICLE: AgreementTemplate = {
  key: 'schedule_vehicle',
  title: 'Schedule B: Vehicle Rental',
  version: '1.0',
  reviewed: false,
  appliesTo: ['fleet_owner'],
  summary: 'Extra terms for car rental and vehicles for sale.',
  clauses: [
    {
      heading: 'Vehicles and papers',
      paragraphs: [
        'You own each vehicle you list or are authorised to hire it out. Each has current registration papers, a valid roadworthiness certificate and insurance that covers commercial hire, kept in the vehicle during every hire.',
      ],
    },
    {
      heading: 'Condition',
      paragraphs: [
        'Vehicles are serviced on schedule, inspected before every hire, clean inside and out, and delivered with the fuel level stated on the listing.',
        'We record the vehicle\'s condition with photos at the start and end of each hire; these are the basis for any damage claim.',
      ],
    },
    {
      heading: 'Drivers',
      paragraphs: [
        'Hires are chauffeur-driven unless the listing clearly offers self-drive. Chauffeurs hold a valid licence, have been vetted, are professionally dressed, and never drive under the influence of alcohol or drugs.',
        'Self-drive is offered only to clients who pass the checks we set (including a valid licence, minimum age and a security deposit).',
      ],
    },
    {
      heading: 'Breakdowns and delays',
      paragraphs: [
        'If a vehicle breaks down or is late, you will provide a comparable replacement as quickly as possible (in Lagos, within 2 hours). If you cannot, the client is refunded for the time lost.',
      ],
    },
    {
      heading: 'Tracking and fines',
      paragraphs: [
        'Any GPS tracking is disclosed on the listing and used only for the vehicle\'s safety and recovery. Fines incurred during a chauffeur-driven hire are your responsibility.',
      ],
    },
  ],
}

const MARINE: AgreementTemplate = {
  key: 'schedule_marine',
  title: 'Schedule C: Boat Cruises, Charters and Aqua Homes',
  version: '1.0',
  reviewed: false,
  appliesTo: ['marine_operator'],
  summary: 'Extra terms for boat cruises, charters, aqua homes and vessels for sale.',
  clauses: [
    {
      heading: 'Permits and crew',
      paragraphs: [
        'Each vessel is registered and operates under current permits from the Lagos State Waterways Authority (LASWA) and/or the National Inland Waterways Authority (NIWA), as applicable.',
        'Every passenger trip is commanded by a licensed captain. Crew do not drink alcohol before or during a trip.',
      ],
    },
    {
      heading: 'Passenger safety',
      paragraphs: [
        'There is a correctly sized life jacket on board for every passenger, worn as the law and the captain require. The vessel\'s passenger capacity is never exceeded.',
        'A passenger list is recorded before departure. You comply with all waterways rules, including restrictions on night-time travel.',
      ],
    },
    {
      heading: 'Weather and cancellations',
      paragraphs: [
        'The captain\'s decision on safety is final. A trip cancelled for weather or safety is rescheduled or refunded in full to the client.',
      ],
    },
    {
      heading: 'Insurance',
      paragraphs: [
        'You hold passenger liability insurance for every vessel used for client trips.',
      ],
    },
    {
      heading: 'Aqua homes',
      paragraphs: [
        'For aqua homes and other stays on the water, the safety, guest experience, privacy and damage terms of Schedule A (Short-let and Rental Properties) also apply.',
      ],
    },
  ],
}

const CHAUFFEUR: AgreementTemplate = {
  key: 'schedule_chauffeur',
  title: 'Schedule D: Chauffeur Services',
  version: '1.0',
  reviewed: false,
  appliesTo: ['chauffeur_service'],
  summary: 'Extra terms for chauffeur services.',
  clauses: [
    {
      heading: 'Chauffeurs',
      paragraphs: [
        'Every chauffeur holds a valid licence, has been vetted (including a police character check where available), and never drives under the influence of alcohol or drugs.',
        'Chauffeurs arrive at least 10 minutes early, are professionally dressed, and are courteous and discreet.',
      ],
    },
    {
      heading: 'Discretion',
      paragraphs: [
        'Chauffeurs never share a client\'s identity, conversations, locations or schedule with anyone, and never post about clients on social media.',
      ],
    },
    {
      heading: 'Vehicles',
      paragraphs: [
        'Any vehicle you provide is insured for hire use, roadworthy and clean. Hours, overtime and fuel are charged only as stated on the listing.',
      ],
    },
  ],
}

const SECURITY: AgreementTemplate = {
  key: 'schedule_security',
  title: 'Schedule E: Close Protection and Security',
  version: '1.0',
  reviewed: false,
  appliesTo: ['security_company'],
  summary: 'Extra terms for close protection and security services.',
  clauses: [
    {
      heading: 'Licence and personnel',
      paragraphs: [
        'You hold a current private guard company licence from the Nigeria Security and Civil Defence Corps (NSCDC) and keep it in force.',
        'Every operative is vetted, trained, fit for duty and carries identification. You do not subcontract an assignment without our written consent.',
      ],
    },
    {
      heading: 'Unarmed services only',
      paragraphs: [
        'Services booked through Lux Catalog are unarmed. Operatives do not carry firearms on these assignments.',
        'Operatives act within the law at all times and use no more force than the law allows in self-defence or the defence of others.',
      ],
    },
    {
      heading: 'Incidents',
      paragraphs: [
        'Any incident during an assignment is reported to the client immediately and to Lux Catalog in writing within 24 hours.',
      ],
    },
    {
      heading: 'Confidentiality',
      paragraphs: [
        'The identity, movements, residence and schedule of every client are strictly confidential, during and after the assignment.',
      ],
    },
    {
      heading: 'Insurance and payment',
      paragraphs: [
        'You hold public liability insurance appropriate to your services. Payouts for an assignment are made after it has been completed.',
      ],
    },
  ],
}

const RETAIL: AgreementTemplate = {
  key: 'schedule_retail',
  title: 'Schedule F: Luxury Goods and Interiors',
  version: '1.0',
  reviewed: false,
  appliesTo: ['brand_retailer'],
  summary: 'Extra terms for brands and retailers selling luxury goods and interiors.',
  clauses: [
    {
      heading: 'Authenticity',
      paragraphs: [
        'Everything you list is genuine. You are an authorised reseller or the brand owner, and you can show provenance on request. Listing counterfeit goods ends this agreement immediately.',
      ],
    },
    {
      heading: 'Condition, delivery and returns',
      paragraphs: [
        'Condition is described accurately. You deliver within the time stated on the listing, insured and well packaged, and honour the returns policy shown on the listing.',
      ],
    },
  ],
}

const AGENT: AgreementTemplate = {
  key: 'schedule_agent',
  title: 'Schedule G: Agents and Brokers',
  version: '1.0',
  reviewed: false,
  appliesTo: ['agent'],
  summary: 'Extra terms for agents and brokers listing on behalf of owners.',
  clauses: [
    {
      heading: 'Mandate and registration',
      paragraphs: [
        'You hold a written mandate from the owner for every asset you list, and show it to us on request. Where you list property in Lagos, you are registered with the Lagos State Real Estate Regulatory Authority (LASRERA).',
      ],
    },
    {
      heading: 'Disclosure',
      paragraphs: [
        'You make clear to clients that you act as an agent, and you tell us at once if your mandate ends or the asset is sold or let elsewhere.',
      ],
    },
  ],
}

export const AGREEMENTS: AgreementTemplate[] = [MASTER, SHORTLET, VEHICLE, MARINE, CHAUFFEUR, SECURITY, RETAIL, AGENT]

export function agreementByKey(key: string) {
  return AGREEMENTS.find((a) => a.key === key)
}

// The agreements a partner must sign: the master agreement, plus the schedule
// for their partner type when we know it.
export function requiredAgreements(partnerType: string | null | undefined) {
  return AGREEMENTS.filter((a) => a.appliesTo === 'all' || (!!partnerType && a.appliesTo.includes(partnerType as PartnerTypeKey)))
}

export type RenderedAgreement = {
  key: string
  title: string
  version: string
  clauses: { heading: string; paragraphs: string[] }[]
}

function commissionText(lines: CommissionLine[]) {
  if (!lines.length) return 'As agreed with you in writing for each listing.'
  return lines.map((l) => `${l.collection}: ${l.ratePercent}% commission, ${l.payout}.`).join('\n')
}

// Fill the partner's details into a template. The result is exactly what the
// partner sees, signs and receives as a PDF.
export function renderAgreement(t: AgreementTemplate, ctx: AgreementContext): RenderedAgreement {
  const fill = (s: string) =>
    s
      .replaceAll('{{partnerName}}', ctx.partnerName)
      .replaceAll('{{businessName}}', ctx.businessName)
      .replaceAll('{{partnerTypeLabel}}', ctx.partnerTypeLabel)
      .replaceAll('{{commissionSchedule}}', commissionText(ctx.commission))
  return {
    key: t.key,
    title: t.title,
    version: t.version,
    clauses: t.clauses.map((c) => ({ heading: fill(c.heading), paragraphs: c.paragraphs.map(fill) })),
  }
}
