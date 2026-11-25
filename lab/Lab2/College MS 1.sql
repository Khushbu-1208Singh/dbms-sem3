CREATE DATABASE IF NOT EXISTS college_management_system;
USE college_management_system;


CREATE TABLE Department (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(50),
    location VARCHAR(50)
);


CREATE TABLE Student (
    student_id INT PRIMARY KEY,
    student_name VARCHAR(50),
    department_id INT,
    age INT,
    FOREIGN KEY (department_id) REFERENCES Department(department_id)
);


CREATE TABLE Course (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(50),
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES Department(department_id)
);


CREATE TABLE Enrollment (
    enrollment_id INT PRIMARY KEY,
    student_id INT,
    course_id INT,
    marks INT,
    FOREIGN KEY (student_id) REFERENCES Student(student_id),
    FOREIGN KEY (course_id) REFERENCES Course(course_id)
);


CREATE TABLE Employee (
    emp_id INT PRIMARY KEY,
    emp_name VARCHAR(50),
    manager_id INT
);


-- Department data
INSERT INTO Department (department_id, department_name, location) VALUES
(1, 'Computer Science', 'Block A'),
(2, 'Mechanical', 'Block B'),
(3, 'Electronics', 'Block C');

-- Student data (Karan has no department -> department_id NULL)
INSERT INTO Student (student_id, student_name, department_id, age) VALUES
(101, 'Aarav', 1, 20),
(102, 'Priya', 1, 21),
(103, 'Rohan', 2, 22),
(104, 'Sneha', 3, 20),
(105, 'Karan', NULL, 21);

-- Course data
INSERT INTO Course (course_id, course_name, department_id) VALUES
(201, 'DBMS', 1),
(202, 'Java', 1),
(203, 'Thermodynamics', 2),
(204, 'Digital Circuits', 3),
(205, 'AI', 1);

-- Enrollment data
INSERT INTO Enrollment (enrollment_id, student_id, course_id, marks) VALUES
(1, 101, 201, 85),
(2, 101, 202, 30),
(3, 102, 201, 92),
(4, 103, 203, 38),
(5, 104, 204, 55),
(6, 102, 205, 60);

-- Employee data (Mr. Sharma has no manager -> manager_id NULL)
INSERT INTO Employee (emp_id, emp_name, manager_id) VALUES
(1, 'Mr. Sharma', NULL),
(2, 'Aarav', 1),
(3, 'Priya', 1),
(4, 'Rohan', 2);
