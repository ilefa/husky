# Husky

![version badge](https://img.shields.io/github/package-json/v/ilefa/husky?color=2573bc)
![vuln badge](https://img.shields.io/snyk/vulnerabilities/github/ilefa/husky)
![codeql badge](https://img.shields.io/github/workflow/status/ilefa/husky/CodeQL?label=codeql%20analysis)

Husky is a TypeScript library that contains several useful utilities for interfacing with UConn services.

## Installation

Use npm to install Husky.

```bash
npm install @ilefa/husky
```

Since Husky is currently hosted on GitHub packages, you will need to make a ``.npmrc`` file in the root of your project, and insert the following:

```env
@ilefa:registry=https://npm.pkg.github.com
```

## Usage

```ts
import {
    getRawEnrollment,
    getRmpReport,
    getServiceStatus
    searchBySection,
    searchCourse,
    searchRMP,
    SearchParts,
    UConnService
} from '@ilefa/husky';

// Lookup a course by it's name, and optionally it's campus
let course = await searchCourse('CSE2050', 'storrs');

// Lookup a course by it's name, using the provided local mappings
let course = await searchCourse('CSE2050', 'storrs', true)

// Lookup a course by it's name, and only retrieve certain parts
let course = await searchCourse('CSE2050', 'storrs', false, [SearchParts.SECTIONS]);

// Lookup a section by the course name and section identifier
let section = await searchBySection('CSE2050', '021L');

// Lookup a professor (via RateMyProfessors)
let prof = await searchRMP('Jacob Scoggin');

// Retrieve a professor report (via RateMyProfessors)
let report = await getRmpReport('2525133');

// Lookup a course's raw enrollment data using it's internal course number
let enrollment = await getRawEnrollment('1218', '13767', '021L');

// Retrieve current UConn service statuses (all of them, or specify some to return)
let statuses = await getServiceStatus();
let statuses = await getServiceStatus(UConnService.HUSKYCT, UConnService.STUDENT_ADMIN);
```

## Course Mappings
Husky offers a complete static set of "course mappings" aka course information from the course catalog.

The data stored in the course mappings JSON file is sorted alphabetically by course name (ABCD1234Q),
and is wrapped in an array. It can be can be imported via ``@ilefa/husky/courses.json``:

```ts
import CourseMappings from '@ilefa/husky/courses.json';

// For example, retrieving GEOG1700 will yield the following data:
let geog1700 = CourseMappings.find(course => course.name === 'GEOG1700');

{
    "name": "GEOG1700",
    "catalogName": "World Regional Geography",
    "catalogNumber": "1700",
    "prerequisites": "RHAG students cannot take more than 22 credits of 1000 level courses",
    "attributes": {
        "lab": false,
        "writing": false,
        "quantitative": false,
        "environmental": false,
        "contentAreas": [
            "CA2",
            "CA4INT"
        ]
    },
    "credits": 3,
    "grading": "Graded",
    "description": "Study of geographic relationships among natural and cultural environments that help to distinguish one part of the world from another. Analysis of selected countries as well as larger regions, with specific reference to the non-western world. CA 2. CA 4-INT."
}
```

In the inevitable case that courses are updated, added, or removed over time, you may execute ``npm run mappings`` to regenerate the mappings. Please note that regenerating will take some time (~26 minutes in my case), but this will depend on your hardware and internet capabilities.

## Manually finding internal course information
*Please note this information is included for your convience within the [searchCourse](index.ts#L144) response under [SectionData#internal](index.ts#L51)*

1. Visit the [UConn Course Catalog](https://catalog.uconn.edu/directory-of-courses/), and find the course you want.

2. Next, open your browser's DOM inspector. This can typically be done by right clicking anywhere on the page, and then clicking *Inspect Element*.

3. Once the inspector is open, find the *Element Picker* button, which is usually found in the top-left of the inspector window. It will have a tooltip that says something along the lines of "Select an element from the page to inspect it."

4. Now, once you click back to the page, you should see that when you hover over elements on the page, they become highlighted. Scroll down to the specific course entry that you would like to track, and click on any of the boxes for that row.

5. Once you click on it, you should see something like this: 

![inspector view of selected row](.assets/selected-element.png)

6. From here, expand the top ``<td>`` element, and you will be able to see the course data. It should look like this: 

![hidden course data](.assets/hidden-course-data.png)

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[GPL-3.0](https://choosealicense.com/licenses/gpl-3.0/)