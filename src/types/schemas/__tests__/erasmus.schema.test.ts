import { describe, it, expect } from 'vitest';
import { ErasmusCountryDataSchema } from '../erasmus.schema';
import type { ErasmusCountryData } from '../../erasmus';

// A representative real erasmus country payload (mirrors reis-data CDN JSON).
const realData: ErasmusCountryData = {
  meta: {
    country: 'Spain',
    countryId: 'es',
    type: 'university',
    reportCount: 1,
    scrapedAt: '2026-07-06T10:00:00.000Z',
  },
  reports: [
    {
      reportId: 'r1',
      student: {
        name: 'Jan Novák',
        email: 'jan@example.com',
        faculty: 'PEF',
        coordinator: 'Dr. X',
      },
      host: {
        name: 'Universidad de Barcelona',
        country: 'Spain',
        coordinators: 'Ms. Y',
        address: 'Barcelona',
        email: 'y@ub.edu',
        phone: '+34...',
      },
      stay: { from: '2025-09-01', to: '2026-01-31', durationMonths: 5 },
      preparation: {
        transport: 'plane',
        transportCost: '150 EUR',
        insurance: 'yes',
        insuranceCost: '50 EUR',
        insuranceEvent: 'none',
        czechHealthInsuranceAccepted: 'yes',
        otherRequirements: 'none',
        reasons: 'language, culture',
        infoSource: 'website',
        languagePrep: 'yes',
        languagePrepDuration: '3 months',
        languagePrepProvider: 'university',
        languagePrepLevel: 'B2',
      },
      admission: { studyDocs: 'transcript', adminDocs: 'passport', fees: 'none' },
      accommodation: {
        automatic: 'yes',
        dormAvailable: 'yes',
        dormDetails: 'shared room',
        otherType: 'none',
        equipment: 'basic',
        notes: 'none',
        canteenAvailable: 'yes',
        otherFood: 'none',
        foodNotes: 'none',
        localTransport: 'metro',
        transportTicket: 'monthly pass',
      },
      study: {
        language: 'Spanish',
        system: 'ECTS',
        integratedWithLocals: 'yes',
        workedIndependently: 'somewhat',
        usesECTS: 'yes',
        specialProgram: 'none',
        organizationNotes: 'none',
        examsCount: '4',
        creditsCount: '30',
        otherOutputs: 'none',
        teachingLevel: 'good',
        languageReadiness: 'good',
        hardestPart: 'exams',
      },
      recognition: { recognized: 'yes', conditions: 'none', problems: 'none' },
      finance: {
        accommodationPerDay: '20 EUR',
        foodPerDay: '10 EUR',
        transportCost: '150 EUR',
        otherCosts: '0',
        otherCostsDescription: 'none',
        totalCostCZK: '50000',
        grantCoveragePercent: '80',
        unaffordable: 'no',
        savings: 'yes',
        grantPayments: 'monthly',
        grantMethod: 'bank transfer',
        otherFunding: 'none',
      },
      leisure: {
        activities: 'sightseeing',
        organizedProgram: 'yes',
        programForm: 'ESN events',
        organizations: 'ESN',
        integrationScore: '9',
        studentServices: 'good',
        sports: 'yes',
        sportsDetails: 'gym',
        libraryAccess: 'yes',
        internetAccess: 'yes',
        internetDetails: 'wifi',
        workOpportunities: 'none',
      },
      tips: {
        problemsDuring: 'none',
        problemsPrep: 'none',
        positivesPrep: 'good support',
        positivesDuring: 'great experience',
      },
      cooperation: { willing: 'yes', howHelp: 'email' },
      overall: { rating: '9', review: 'great', suggestions: 'none' },
    },
  ],
};

describe('ErasmusCountryDataSchema', () => {
  it('accepts a representative real payload (never drops valid data)', () => {
    expect(ErasmusCountryDataSchema.safeParse(realData).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = {
      ...realData,
      futureField: 'x',
      reports: [{ ...realData.reports[0], brandNewFlag: true }],
    };
    expect(ErasmusCountryDataSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts a report with most sub-sections missing (CDN drift, no anchor drop)', () => {
    const minimalReport = { reportId: 'r2' };
    expect(
      ErasmusCountryDataSchema.safeParse({ ...realData, reports: [minimalReport] }).success
    ).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(ErasmusCountryDataSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: reports is not an array', () => {
    expect(ErasmusCountryDataSchema.safeParse({ ...realData, reports: 'nope' }).success).toBe(
      false
    );
  });

  it('rejects genuine corruption: report missing reportId', () => {
    const { reportId: _reportId, ...noReportId } = realData.reports[0]!; // safe: fixed literal
    expect(ErasmusCountryDataSchema.safeParse({ ...realData, reports: [noReportId] }).success).toBe(
      false
    );
  });

  it('rejects genuine corruption: missing meta.countryId', () => {
    const { countryId: _countryId, ...noCountryId } = realData.meta;
    expect(ErasmusCountryDataSchema.safeParse({ ...realData, meta: noCountryId }).success).toBe(
      false
    );
  });
});
