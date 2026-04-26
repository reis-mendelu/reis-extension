import type { IskamProfile } from '../../../types/iskam';

export function parseProfile(html: string): IskamProfile | null {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    const getValueByLabelFor = (labelFor: string): string => {
        const label = Array.from(doc.querySelectorAll('label')).find(l => l.getAttribute('for') === labelFor);
        if (!label) return '';
        
        const formGroup = label.closest('.form-group');
        if (!formGroup) return '';
        
        const valueDiv = formGroup.querySelector('.form-control-static');
        return (valueDiv?.textContent || '').trim();
    };

    const firstName = getValueByLabelFor('Jmeno');
    const lastName = getValueByLabelFor('Prijmeni');
    const email = getValueByLabelFor('Email');

    if (!firstName && !lastName) return null;

    return {
        fullName: `${firstName} ${lastName}`.trim(),
        email: email,
    };
}
