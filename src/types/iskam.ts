export interface KontoRow {
    name: string;
    nameCs?: string;
    nameEn?: string;
    balance: number;
    balanceText: string;
    topUpHref: string | null;
    transactionsHref: string | null;
}

export type UbytovaniStatus = 'Ubytovaný' | 'Rezervace' | 'Odhlášen' | string;

export interface UbytovaniRow {
    dorm: string;
    block: string;
    room: string;
    startDate: string;
    endDate: string;
    status: UbytovaniStatus;
    contractHref: string | null;
}

export interface IskamProfile {
    fullName: string;
    email: string;
}

export interface IskamReservation {
    facility: string;
    room: string;
    startDate: string;
    endDate: string;
    price?: string;
}

export interface VolneKapacityRoom {
    floor: string;
    room: string;
    beds: number;
    free: number;
    nationalities: string;
}

export interface PendingPayment {
    dueDate: string;
    description: string;
    amount: string;
}

export interface SkmDocument {
    label: string;
    href: string;
}

export interface KontaTransaction {
    datetime: string;       // "27.4.2026 12:48:02"
    settledDate: string;    // "27.4.2026"
    type: string;           // "Úhrada" | "Převod" | ...
    description: string;
    topUp: number | null;   // Nabíjení column
    payment: number | null; // Úhrady column
    balance: number;        // Zůstatek column
}

export interface IskamData {
    konta: KontoRow[];
    ubytovani: UbytovaniRow[];
    profile?: IskamProfile;
    reservations: IskamReservation[];
    pendingPayments: PendingPayment[];
    foodTransactions: KontaTransaction[];
    lastTopUp: number | null;
    syncedAt: number;
}
