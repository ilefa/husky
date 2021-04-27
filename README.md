# Husky

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
    getServiceStatus
    searchBySection,
    searchCourse,
    searchRMP,
    UConnService
} from '@ilefa/husky';

// Lookup a course by it's name, and optionally by it's campus
let course = await searchCourse('CSE1729', 'storrs');

// Lookup a section by the course name and section identifier
let section = await searchBySection('CSE1729', '015L');

// Lookup a professor (via RateMyProfessors)
let prof = await searchRMP('Gregory Johnson');

// Lookup a course's raw enrollment data using it's internal course number
let enrollment = await getRawEnrollment('1208', '6011', '001');

// Retrieve current UConn service statuses (all of them, or specify some to return)
let statuses = await getServiceStatus();
let statuses = await getServiceStatus(UConnService.HUSKYCT, UConnService.STUDENT_ADMIN);
```

## Finding internal course information
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