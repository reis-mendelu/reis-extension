export class IskamAuthError extends Error {
    constructor(message = 'WebISKAM Shibboleth session missing or expired') {
        super(message);
        this.name = 'IskamAuthError';
    }
}
