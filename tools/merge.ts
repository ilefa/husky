import fs from 'fs';

import { CourseAttributes } from '..';

type Course = {
    name: string;
    catalogName: string;
    catalogNumber: string;
    prerequisites: string;
    attributes: CourseAttributes; 
    credits: number;
    grading: string;
    description: string;
}

const DEFAULT_PREREQS = 'There are no prerequisites for this course.';
const DEFAULT_DESC = 'There is no description provided for this course.';

const start = Date.now();

// Open all files that start with 'courses' and read them into memory.
const courseFiles = fs.readdirSync('.').filter(file => file.startsWith('courses') && !/courses-\d+.json/.test(file) && file.endsWith('.json'));
if (!courseFiles.length) {
    console.warn('[!] Exited with status code 1, could not find any course mapping files.');
    process.exit(1);
}

if (courseFiles.length === 1) {
    console.warn('[!] Exited with status code 1, merging requires two or more files to function.');
    process.exit(1);
}

let latest = courseFiles.find(file => file === 'courses.json');
if (!latest) latest = 'courses-' + courseFiles.reduce((acc, file) => {
    const [_, num] = file.split('-');
    return Math.max(acc, parseInt(num));
}, 0) + '.json';

let latestPayload = JSON.parse(fs.readFileSync(`./${latest}`, 'utf8')) as Course[];
console.log(`[*] Latest payload: ${latest}`);
console.log(`[*] Located ${courseFiles.length} mapping payloads:`);
courseFiles.forEach(file => console.log(`    - ${file}`));

console.log('[*] Ready to perform merge..');

let courseObjects: Course[] = [];

for (const courseFile of courseFiles) {
    const course = JSON.parse(fs.readFileSync(`./${courseFile}`, 'utf8')) as Course[];
    console.log(`[*] [Manifest] ${courseFile} :: ${course.length} entr${course.length === 1 ? 'y' : 'ies'}`);
    courseObjects = courseObjects.concat(course);
}

let allCourses: Course[] = latestPayload;

const patchAttributes = (existing: Course, target: Course) => {
    if (!existing.description || existing.description === DEFAULT_DESC
            && (target.description && target.description !== DEFAULT_DESC))
        existing.description = target.description;

    if (!existing.prerequisites || existing.prerequisites === DEFAULT_PREREQS
            && (target.prerequisites && target.prerequisites !== DEFAULT_PREREQS))
        existing.prerequisites = target.prerequisites;

    if (!existing.attributes && target.attributes)
        existing.attributes = target.attributes;

    if (existing.attributes && target.attributes) {
        if (!existing.attributes.lab && target.attributes.lab)
            existing.attributes.lab = target.attributes.lab;

        if (!existing.attributes.writing && target.attributes.writing)
            existing.attributes.writing = target.attributes.writing;

        if (!existing.attributes.quantitative && target.attributes.quantitative)
            existing.attributes.quantitative = target.attributes.quantitative;

        if (!existing.attributes.environmental && target.attributes.environmental)
            existing.attributes.environmental = target.attributes.environmental;

        if (!existing.attributes.contentAreas && target.attributes.contentAreas)
            existing.attributes.contentAreas = target.attributes.contentAreas;
    }

    if (!existing.credits && target.credits)
        existing.credits = target.credits;

    if (!existing.grading && target.grading)
        existing.grading = target.grading;

    return existing;
}

// Iterate through all courses and add them to the master list if they do not exist yet.
for (const course of courseObjects) {
    const existing = allCourses.find(c => c.name === course.name
                                  && c.catalogName === course.catalogName
                                  && c.catalogNumber === course.catalogNumber);
    
    if (!existing) {
        allCourses.push(course);
        console.log(`[*] [New - ${allCourses.length}] ${course.name} :: ${course.catalogName}`);
        continue;
    }

    // Patch existing and replace it.
    let target = allCourses.indexOf(existing);
    let patched = patchAttributes(existing, course);
    if (patched === existing)
        continue;
    
    console.log(`[*] [Patch] ${existing.name} was patched.`);
    allCourses[target] = patched;
}

console.log(`[*] Latest: ${latestPayload.length}, all: ${allCourses.length}, delta: ${allCourses.length - latestPayload.length}`);

let timestamp = Date.now();
if (latest === 'courses.json') {
    fs.renameSync(latest, `courses-${timestamp}.json`);
    console.log(`[*] Saved intermediate payload to courses-${timestamp}.json`)
}

allCourses = allCourses
    .filter(a => a.name)
    .sort((a, b) => a.name.localeCompare(b.name));

// Write the merged object to a file.
fs.writeFileSync('./courses.json', JSON.stringify(allCourses, null, 4));
console.log('[*] Merged payload written to disk.');
console.log(`[*] Finished in ${Date.now() - start}ms.`);