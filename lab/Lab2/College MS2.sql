-- Display student names along with their department names.
SELECT s.student_name, d.department_name
FROM Student s
JOIN Department d ON s.department_id = d.department_id; 

-- Display all students and their corresponding department locations.
SELECT s.student_name, d.location
FROM Student s
JOIN Department d ON s.department_id = d.department_id;

-- Display the details of all courses along with their department names.
SELECT c.*, d.department_name
FROM Course c
JOIN Department d ON c.department_id = d.department_id;

-- Display student name, course name, and marks obtained by each student.
SELECT s.student_name, c.course_name, e.marks
FROM Student s
JOIN Enrollment e ON s.student_id = e.student_id
JOIN Course c ON e.course_id = c.course_id;

-- Display all students who are enrolled in courses.
SELECT DISTINCT s.student_id, s.student_name
FROM Student s
JOIN Enrollment e ON s.student_id = e.student_id;

-- Use INNER JOIN to display Student_Name | Department_Name.
SELECT s.student_name AS Student_Name, d.department_name AS Department_Name
FROM Student s
INNER JOIN Department d ON s.department_id = d.department_id;

-- Find the details of students belonging to the "Computer Science" department.
SELECT s.*
FROM Student s
INNER JOIN Department d ON s.department_id = d.department_id
WHERE d.department_name = 'Computer Science';

-- Display Student Name, Course Name, Marks for all enrolled students.
SELECT s.student_name, c.course_name, e.marks
FROM Student s
INNER JOIN Enrollment e ON s.student_id = e.student_id
INNER JOIN Course c ON e.course_id = c.course_id;

-- Display department-wise student details using INNER JOIN.
SELECT d.department_name, s.student_name, s.age
FROM Department d
INNER JOIN Student s ON d.department_id = s.department_id
ORDER BY d.department_name;

-- Display all students along with their department names, including students who do not belong to any department.
SELECT s.student_name, d.department_name
FROM Student s
LEFT JOIN Department d ON s.department_id = d.department_id;

-- Find students who are not enrolled in any course.
SELECT s.student_name
FROM Student s
LEFT JOIN Enrollment e ON s.student_id = e.student_id
WHERE e.enrollment_id IS NULL;

-- Display all departments and the students belonging to them, including departments with no students.
SELECT d.department_name, s.student_name
FROM Department d
LEFT JOIN Student s ON d.department_id = s.department_id; 

-- Display all courses along with enrolled students, including courses having no enrollment.
SELECT c.course_name, s.student_name
FROM Course c
LEFT JOIN Enrollment e ON c.course_id = e.course_id
LEFT JOIN Student s ON e.student_id = s.student_id;

-- Display all departments and their students using RIGHT JOIN.
SELECT d.department_name, s.student_name
FROM Student s
RIGHT JOIN Department d ON s.department_id = d.department_id;

-- Display all courses and their enrolled students using RIGHT JOIN.
SELECT c.course_name, s.student_name
FROM Enrollment e
RIGHT JOIN Course c ON e.course_id = c.course_id
LEFT JOIN Student s ON e.student_id = s.student_id;

-- Display complete student course information: Student Name, Department Name, Course Name, Marks.
SELECT s.student_name, d.department_name, c.course_name, e.marks
FROM Student s
JOIN Department d ON s.department_id = d.department_id
JOIN Enrollment e ON s.student_id = e.student_id
JOIN Course c ON e.course_id = c.course_id;

-- Display Student Name, Department Location, Course Name using multiple JOIN operations.
SELECT s.student_name, d.location, c.course_name
FROM Student s
JOIN Department d ON s.department_id = d.department_id
JOIN Enrollment e ON s.student_id = e.student_id
JOIN Course c ON e.course_id = c.course_id;

-- Find the average marks obtained by students in each course along with the course name.
SELECT c.course_name, AVG(e.marks) AS average_marks
FROM Course c
JOIN Enrollment e ON c.course_id = e.course_id
GROUP BY c.course_name;

-- Display Department Name, Number of Students using JOIN and GROUP BY.
SELECT d.department_name, COUNT(s.student_id) AS number_of_students
FROM Department d
LEFT JOIN Student s ON d.department_id = s.department_id
GROUP BY d.department_name;

-- Display Department Name, Course Name, Number of Students Enrolled.
SELECT d.department_name, c.course_name, COUNT(e.student_id) AS students_enrolled
FROM Department d
JOIN Course c ON d.department_id = c.department_id
LEFT JOIN Enrollment e ON c.course_id = e.course_id
GROUP BY d.department_name, c.course_name;

-- Find the student who scored the highest marks in each course.
SELECT c.course_name, s.student_name, e.marks
FROM Enrollment e
JOIN Course c ON e.course_id = c.course_id
JOIN Student s ON e.student_id = s.student_id
WHERE e.marks = (
    SELECT MAX(e2.marks) FROM Enrollment e2 WHERE e2.course_id = e.course_id
);

-- Display departments where no student is registered.
SELECT d.department_name
FROM Department d
LEFT JOIN Student s ON d.department_id = s.department_id
WHERE s.student_id IS NULL; 

-- Display courses in which no student has enrolled.
SELECT c.course_name
FROM Course c
LEFT JOIN Enrollment e ON c.course_id = e.course_id
WHERE e.enrollment_id IS NULL; 

-- Find the total number of students in each department.
SELECT d.department_name, COUNT(s.student_id) AS total_students
FROM Department d
LEFT JOIN Student s ON d.department_id = s.department_id
GROUP BY d.department_name;

-- Display the complete report: Student ID, Student Name, Department, Course, Marks, Result Status.
SELECT s.student_id, s.student_name, d.department_name, c.course_name, e.marks,
    CASE WHEN e.marks >= 40 THEN 'Pass' ELSE 'Fail' END AS Result_Status
FROM Student s
JOIN Department d ON s.department_id = d.department_id
JOIN Enrollment e ON s.student_id = e.student_id
JOIN Course c ON e.course_id = c.course_id;

-- Display employee name with their manager name using SELF JOIN.
SELECT e.emp_name AS Employee_Name, m.emp_name AS Manager_Name
FROM Employee e
LEFT JOIN Employee m ON e.manager_id = m.emp_id;

-- Find departments having more than 5 students using JOIN and GROUP BY.
SELECT d.department_name, COUNT(s.student_id) AS total_students
FROM Department d
JOIN Student s ON d.department_id = s.department_id
GROUP BY d.department_name
HAVING COUNT(s.student_id) > 5;

-- Find the second highest marks obtained by students using JOIN.
SELECT MAX(e1.marks) AS second_highest_marks
FROM Enrollment e1
JOIN Enrollment e2 ON e1.marks < e2.marks;

-- Display students who have enrolled in more than one course.
SELECT s.student_name, COUNT(e.course_id) AS courses_taken
FROM Student s
JOIN Enrollment e ON s.student_id = e.student_id
GROUP BY s.student_name
HAVING COUNT(e.course_id) > 1;

-- Generate a complete college report showing Department → Students → Courses → Marks.
SELECT d.department_name, s.student_name, c.course_name, e.marks
FROM Department d
JOIN Student s ON d.department_id = s.department_id
JOIN Enrollment e ON s.student_id = e.student_id
JOIN Course c ON e.course_id = c.course_id
ORDER BY d.department_name, s.student_name, c.course_name;