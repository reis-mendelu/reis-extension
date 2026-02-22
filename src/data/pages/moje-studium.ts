import type { PageCategory } from './types';
import { mojeStudiumItemsPart1 } from './moje-studium-part1';
import { mojeStudiumItemsPart2 } from './moje-studium-part2';

export const mojeStudium: PageCategory = {
    "id": "moje-studium",
    "label": "Moje studium",
    "icon": "GraduationCap",
    "expandable": true,
    "children": [
        ...mojeStudiumItemsPart1,
        ...mojeStudiumItemsPart2
    ]
};