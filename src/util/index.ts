import { CampusType } from '..';

export * from './types';
export * from './building';

/**
 * Attempts to guess what campus a certain
 * section is being taught at.
 * 
 * Notice: This method will not always work,
 * as off-campus courses and Storrs courses
 * both do not have alphabetic prefixes, and
 * just start with a the section number.
 * 
 * @param section the section name
 */
export const detectCampusBySection = (section: string): CampusType => {
    switch (section.substring(0, 1).toLowerCase()) {
        case 'h':
            return 'hartford';
        case 'z':
            return 'stamford';
        case 'w':
            return 'waterbury';
        case 'n':
            return 'avery_point';
        default:
            return 'storrs';
    }
}

/**
 * Returns whether or not the provided campus
 * is a valid member of the {@link CampusType} type.
 * 
 * @param input the inputted campus
 */
export const isCampusType = (input: string): input is CampusType => {
    let lower = input.toLowerCase();
    return lower === 'any'
        || lower === 'storrs'
        || lower === 'hartford'
        || lower === 'stamford'
        || lower === 'waterbury'
        || lower === 'avery_point'
}

export const getCatalogUrl = (prefix: string, number: string) => {
    let num = parseInt(number.replace(/[^0-9]/g, ''));
    if (num > 5000 && (prefix !== 'PHRX' || (prefix === 'PHRX' && num < 5199)))
        return `https://gradcatalog.uconn.edu/course-descriptions/course/${prefix}/${number}/`;
    return `https://catalog.uconn.edu/directory-of-courses/course/${prefix}/${number.length === 3 ? ' ' + number : number}/`;
}