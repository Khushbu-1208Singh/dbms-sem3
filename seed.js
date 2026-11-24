// Run once:  MONGODB_URI="mongodb+srv://..." node seed.js
const { MongoClient } = require('mongodb');
const { alertFor } = require('./server');
(async () => {
  const cl = await new MongoClient(process.env.MONGODB_URI).connect();
  const d = cl.db(process.env.DB_NAME || 'examguard');
  await d.dropDatabase();
  const codes = ['NIT', 'REC', 'SCS', 'HCU', 'LVP', 'AMC'];
  const F = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vikram', 'Anaya', 'Arjun', 'Sara'];
  const L = ['Sharma', 'Verma', 'Khan', 'Patel', 'Singh', 'Nair', 'Das', 'Mehta'];
  const students = Array.from({ length: 60 }, (_, i) => { const n = i + 1, c = 1 + ((n + Math.floor(n / 7)) % 6);
    return { student_id: n, roll_no: 'R' + String(n).padStart(3, '0'), name: `${F[n % 10]} ${L[(n * 3) % 8]}`, college_id: c, college_code: codes[c - 1] }; });
  const courses = Array.from({ length: 15 }, (_, i) => ({ course_id: i + 1, code: 'CS' + (101 + i), title: 'Core Subject ' + (i + 1), semester: Math.ceil((i + 1) / 3) }));
  const marks = [], alerts = [], past = {};
  for (const c of courses.filter(c => c.semester <= 4)) for (const s of students) {
    const sc = Math.min(100, Math.max(20, 48 + (s.student_id * 7) % 22 + (s.student_id * c.course_id * 13) % 13 - 6 + (c.semester === 4 && [7, 23, 41, 52].includes(s.student_id) ? 38 : 0)));
    const m = { mark_id: marks.length + 1, student_id: s.student_id, course_id: c.course_id, semester: c.semester, code: c.code, title: c.title, score: sc };
    const before = (past[s.student_id] ??= []).filter(x => x.sem < c.semester);
    if (before.length) { const a = alertFor(s, m, before.reduce((t, x) => t + x.sc, 0) / before.length); if (a) alerts.push({ ...a, alert_id: alerts.length + 1 }); }
    past[s.student_id].push({ sem: c.semester, sc }); marks.push(m);
  }
  await d.collection('colleges').insertMany(codes.map((code, i) => ({ college_id: i + 1, code })));
  await d.collection('students').insertMany(students);
  await d.collection('courses').insertMany(courses);
  await d.collection('marks').insertMany(marks);
  await d.collection('alerts').insertMany(alerts);
  await d.collection('halls').insertMany(['Hall A', 'Hall B', 'Hall C'].map((name, i) => ({ hall_id: i + 1, name, n_rows: 5, n_cols: 6 })));
  await d.collection('counters').insertMany([{ _id: 'marks', n: marks.length }, { _id: 'alerts', n: alerts.length }]);
  await d.collection('marks').createIndex({ student_id: 1, course_id: 1 }, { unique: true });
  await d.collection('revals').createIndex({ req_id: 1 }, { unique: true });
  console.log(`Seeded ${students.length} students, ${marks.length} marks, ${alerts.length} alerts`);
  await cl.close();
})().catch(e => { console.error(e); process.exit(1); });
