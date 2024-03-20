# Husky

![version badge](https://img.shields.io/github/package-json/v/ilefa/husky?color=2573bc)

Husky is a TypeScript library that contains several useful utilities for interfacing with UConn services.

## Installation

Use npm to install Husky.

```bash
npm install @ilefa/husky
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

## Heads up

If you plan to utilize any of the mappings files directly in a TypeScript project, you will need to specify the ``resolveJsonModule`` option as ``true`` in the compiler options of your ``tsconfig.json`` file.

If you do not, you may have a problem importing the JSON file directly.

## Course Mappings
Husky offers a complete static set of "course mappings" aka course information from the course catalog.

The data stored in the course mappings JSON file is sorted alphabetically by course name (ABCD1234Q),
and is wrapped in an array. It can be can be imported via ``@ilefa/husky/courses.json`` or can be fetched
using the set of mapping helper functions: [getMappings](./src/index.ts#L344), [getMappingByAttribute](./src/index.ts#L352), and [getMappingMatches](./src/index.ts#L360).

```ts
import { getMappingByAttribute, getMappingMatches } from '@ilefa/husky';

// For example, retrieving GEOG1700 will yield the following data:
let geog1700 = getMappingByAttribute('name', 'GEOG1700');

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
        ],
        "graduate": false
    },
    "credits": 3,
    "grading": "Graded",
    "description": "Study of geographic relationships among natural and cultural environments that help to distinguish one part of the world from another. Analysis of selected countries as well as larger regions, with specific reference to the non-western world. CA 2. CA 4-INT."
}

// Or, how about we get all CSE courses:
let cseCourses = getMappingMatches('name', name => name.startsWith('CSE'));

[
    ...
    {
        name: 'CSE1010',
        catalogName: 'Introduction to Computing for Engineers',
        catalogNumber: '1010',
        prerequisites: 'May not be taken out of sequence after passing CSE 1729 or 2050.',
        attributes: {
            lab: false,
            writing: false,
            quantitative: false,
            environmental: false,
            contentAreas: [],
            graduate: false
        },
        credits: 3,
        grading: 'Graded',
        description: 'Introduction to computing logic, algorithmic thinking, computing processes, a programming language and computing environment. Knowledge obtained in this course enables use of the computer as an instrument to solve computing problems. Representative problems from science, mathematics, and engineering will be solved.'
    },
    ...
]
```

## Classroom Mappings
Husky also offers a complete static set of "classroom mappings" aka classroom information from the [classroom viewer website](https://classrooms.uconn.edu/classroom/).

The data stored in the classroom mappings JSON file is sorted alphabetically by room name (BLDG1234),
and is wrapped in an array. It can be can be imported via ``@ilefa/husky/classrooms.json`` or can be fetched using the set of helper functions: [getClassrooms](./src/index#L369), [getClassroomsForBuilding](./src/index.ts#L377), [getClassroomByAttribute](./src/index.ts#L385), [getClassroomMatches](./src/index.ts#L398).

```ts
import { getClassroomByAttribute, getClassroomsForBuilding } from '@ilefa/husky';

// For example, retrieving ARJ105 will yield the following data:
let arj105 = getClassroomByAttribute('name', 'ARJ105');

{
    "name": "ARJ105",
    "building": {
        "name": "Arjona",
        "code": "ARJ",
        "campus": "STORRS",
    },
    "room": "105",
    "techType": "FULL",
    "techDescription": "",
    "seatingType": "FIXED_AUDITORIUM",
    "boardType": "WHITEBOARD",
    "capacity": {
        "covid": 42,
        "full": 226
    },
    "byodTesting": true,
    "airConditioned": false,
    "videoConference": {
        "name": "Teach From Video Conference",
        "attributes": {
            "shareContent": true,
            "instructorFacingCamera": true,
            "studentFacingCamera": false,
            "presentMediaFrontOfRoom": false,
            "presentMediaBackOfRoom": true,
            "instructorMicrophone": true,
            "studentMicrophone": false,
            "connectToWebex": true
        }
    },
    "lectureCapture": "ALL",
    "liveStreamUrl": "http://www.kaltura.com/tiny/rw5g6",
    "threeSixtyView": "https://live.staticflickr.com/65535/47864045151_3b4af52c27_o_d.jpg"
}

// You can also lookup all classrooms for a given building or campus:
let arjRooms = getClassroomsForBuilding('code', 'ARJ')
             = getClassroomsForBuilding('name', 'Arjona')
             = getClassroomsForBuilding('campus', 'STORRS');

// Lastly, you can also lookup classrooms by their attributes
let auditoriums = getClassroomMatches('seatingType', type => type === 'FIXED_AUDITORIUM');
```

In the case that classrooms are updated, added, or removed over time, you may execute ``npm run classrooms`` to regenerate the mappings.

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