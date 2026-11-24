const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

// ---- connection (cached so serverless hosts reuse it) ----
let cp;
const client = () => (cp ??= new MongoClient(process.env.MONGODB_URI).connect());
const db = async () => (await client()).db(process.env.DB_NAME || 'examguard');
const col = async n => (await db()).collection(n);
const nextId = async n => (await (await col('counters')).findOneAndUpdate({ _id: n }, { $inc: { n: 1 } }, { upsert: true, returnDocument: 'after' })).n;
const r2 = x => Math.round(x * 100) / 100;

// ---- audit log helper: every change is written here ----
const audit = async (table_name, record_id, action, old_value, new_value, changed_by, session) =>
  (await col('audit')).insertOne({ table_name, record_id, action, old_value, new_value, changed_by, changed_at: new Date() }, { session });

// ---- malpractice rule: score at least 25 above the average of earlier semesters ----
function alertFor(s, m, past) {
  const jump = m.score - past;
  if (jump < 25) return null;
  return { student_id: s.student_id, name: s.name, roll_no: s.roll_no, mark_id: m.mark_id, semester: m.semester,
    past_avg: r2(past), new_score: m.score, jump: r2(jump), severity: jump >= 40 ? 'HIGH' : 'MEDIUM', status: 'OPEN', raised_at: new Date() };
}
async function addMark(sid, cid, score) {
  sid = +sid; cid = +cid; score = +score;
  if (!(score >= 0 && score <= 100)) throw new Error('Score must be between 0 and 100');
  const [S, C, M, A] = await Promise.all(['students', 'courses', 'marks', 'alerts'].map(col));
  const st = await S.findOne({ student_id: sid }); if (!st) throw new Error('Unknown student');
  const c = await C.findOne({ course_id: cid }); if (!c) throw new Error('Unknown course');
  if (await M.findOne({ student_id: sid, course_id: cid })) throw new Error('A mark already exists for this student and course');
  const m = { mark_id: await nextId('marks'), student_id: sid, course_id: cid, semester: c.semester, code: c.code, title: c.title, score };
  await M.insertOne(m);
  const [p] = await M.aggregate([{ $match: { student_id: sid, semester: { $lt: c.semester } } }, { $group: { _id: null, avg: { $avg: '$score' } } }]).toArray();
  const a = p && alertFor(st, m, p.avg);
  if (a) { a.alert_id = await nextId('alerts'); await A.insertOne(a); }
}

const conflicts = seats => {
  const k = new Map(seats.map(x => [`${x.hall_id}-${x.seat_row}-${x.seat_col}`, x.college_id]));
  let n = 0;
  for (const x of seats) for (const [dr, dc] of [[0, 1], [1, 0]])
    if (k.get(`${x.hall_id}-${x.seat_row + dr}-${x.seat_col + dc}`) === x.college_id) n++;
  return n;
};

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }));

app.get('/api/overview', wrap(async (_, res) => {
  const [S, A, R, T] = await Promise.all(['students', 'alerts', 'revals', 'seats'].map(col));
  const seats = await T.find({ exam_id: 1 }).toArray();
  res.json({ students: await S.countDocuments(), openAlerts: await A.countDocuments({ status: { $in: ['OPEN', 'UNDER_REVIEW'] } }),
    pendingReval: await R.countDocuments({ status: 'PENDING' }), conflicts: conflicts(seats), seated: seats.length });
}));
app.get('/api/students', wrap(async (_, res) => res.json(await (await col('students')).find({}, { projection: { _id: 0 } }).sort({ student_id: 1 }).toArray())));
app.get('/api/students/:id/marks', wrap(async (req, res) => {
  const id = +req.params.id;
  const marks = await (await col('marks')).find({ student_id: id }, { projection: { _id: 0 } }).sort({ semester: 1, course_id: 1 }).toArray();
  const rv = await (await col('revals')).find({ student_id: id }).sort({ req_id: 1 }).toArray();
  res.json(marks.map(m => ({ ...m, reval_status: rv.filter(r => r.mark_id === m.mark_id).pop()?.status ?? null })));
}));

// ---- seat allocation: no same-college student on the left or in front ----
app.post('/api/allocate/:exam', wrap(async (req, res) => {
  const exam = +req.params.exam;
  const [H, S, T] = await Promise.all(['halls', 'students', 'seats'].map(col));
  const halls = await H.find().sort({ hall_id: 1 }).toArray();
  const studs = await S.find().sort({ student_id: 1 }).toArray();
  const left = {}; studs.forEach(s => (left[s.college_id] ??= []).push(s));
  const grid = new Map(), out = [];
  for (const h of halls) for (let r = 1; r <= h.n_rows; r++) for (let c = 1; c <= h.n_cols; c++) {
    const lc = grid.get(`${h.hall_id}-${r}-${c - 1}`), uc = grid.get(`${h.hall_id}-${r - 1}-${c}`);
    const pick = Object.keys(left).filter(k => left[k].length && +k !== lc && +k !== uc)
      .sort((a, b) => left[b].length - left[a].length || a - b)[0];   // college with most students still unseated
    if (!pick) continue;                                              // leave seat empty rather than break the rule
    const s = left[pick].shift();
    grid.set(`${h.hall_id}-${r}-${c}`, s.college_id);
    out.push({ exam_id: exam, hall_id: h.hall_id, seat_row: r, seat_col: c, student_id: s.student_id, roll_no: s.roll_no, name: s.name, college_id: s.college_id, college_code: s.college_code });
  }
  await T.deleteMany({ exam_id: exam });
  if (out.length) await T.insertMany(out);
  res.json({ seated: out.length, unseated: studs.length - out.length });
}));
app.get('/api/seating/:exam', wrap(async (req, res) => {
  const halls = await (await col('halls')).find({}, { projection: { _id: 0 } }).sort({ hall_id: 1 }).toArray();
  const raw = await (await col('seats')).find({ exam_id: +req.params.exam }, { projection: { _id: 0 } }).toArray();
  const H = Object.fromEntries(halls.map(h => [h.hall_id, h]));
  res.json({ halls, conflicts: conflicts(raw), seats: raw.map(s => ({ ...s, hall: H[s.hall_id].name, n_rows: H[s.hall_id].n_rows, n_cols: H[s.hall_id].n_cols })) });
}));

// ---- rank / percentile with $setWindowFields ----
app.get('/api/ranks/:sem', wrap(async (req, res) => res.json(await (await col('marks')).aggregate([
  { $match: { semester: +req.params.sem } },
  { $group: { _id: '$student_id', semester: { $first: '$semester' }, total: { $sum: '$score' }, avg: { $avg: '$score' } } },
  { $lookup: { from: 'students', localField: '_id', foreignField: 'student_id', as: 's' } }, { $unwind: '$s' },
  { $project: { _id: 0, student_id: '$_id', semester: 1, total: 1, avg_score: { $round: ['$avg', 2] }, name: '$s.name', roll_no: '$s.roll_no', college_id: '$s.college_id', college_code: '$s.college_code' } },
  { $setWindowFields: { sortBy: { total: -1 }, output: {
      rank_no: { $rank: {} }, dense_rank_no: { $denseRank: {} }, row: { $documentNumber: {} },
      n: { $count: {}, window: { documents: ['unbounded', 'unbounded'] } } } } },
  { $setWindowFields: { partitionBy: '$college_id', sortBy: { total: -1 }, output: { college_rank: { $rank: {} } } } },
  { $addFields: {
      percentile: { $round: [{ $multiply: [100, { $subtract: [1, { $cond: [{ $gt: ['$n', 1] }, { $divide: [{ $subtract: ['$rank_no', 1] }, { $subtract: ['$n', 1] }] }, 0] }] }] }, 2] },
      quartile: { $add: [{ $floor: { $divide: [{ $multiply: [{ $subtract: ['$row', 1] }, 4] }, '$n'] } }, 1] } } },
  { $project: { row: 0, n: 0 } }, { $sort: { rank_no: 1, roll_no: 1 } }
]).toArray())));

// ---- marks + malpractice alerts ----
app.post('/api/marks', wrap(async (req, res) => { await addMark(req.body.student_id, req.body.course_id, req.body.score); res.json({ ok: true }); }));
app.get('/api/alerts', wrap(async (_, res) => {
  const order = { OPEN: 0, UNDER_REVIEW: 1, CONFIRMED: 2, CLEARED: 3 };
  const a = await (await col('alerts')).find({}, { projection: { _id: 0 } }).toArray();
  res.json(a.sort((x, y) => order[x.status] - order[y.status] || y.jump - x.jump));
}));
app.patch('/api/alerts/:id', wrap(async (req, res) => {
  const { status, actor = 'controller' } = req.body;
  if (!['OPEN', 'UNDER_REVIEW', 'CLEARED', 'CONFIRMED'].includes(status)) throw new Error('Invalid status');
  const A = await col('alerts'), a = await A.findOne({ alert_id: +req.params.id });
  if (!a) throw new Error('Alert not found');
  await A.updateOne({ alert_id: a.alert_id }, { $set: { status } });
  await audit('malpractice_alert', a.alert_id, 'STATUS_CHANGED', a.status, status, actor);
  res.json({ ok: true });
}));

// ---- revaluation workflow ----
app.get('/api/reval', wrap(async (_, res) => {
  const r = await (await col('revals')).find({}, { projection: { _id: 0 } }).toArray();
  res.json(r.sort((a, b) => (b.status === 'PENDING') - (a.status === 'PENDING') || b.req_id - a.req_id));
}));
app.post('/api/reval', wrap(async (req, res) => {
  const sid = +req.body.student_id, mid = +req.body.mark_id;
  const [M, R, S] = await Promise.all(['marks', 'revals', 'students'].map(col));
  const m = await M.findOne({ mark_id: mid, student_id: sid }); if (!m) throw new Error('This mark does not belong to the student');
  if (await R.findOne({ mark_id: mid, status: 'PENDING' })) throw new Error('A revaluation for this mark is already pending');
  const st = await S.findOne({ student_id: sid });
  const req_id = await nextId('revals');
  await R.insertOne({ req_id, mark_id: mid, student_id: sid, name: st.name, roll_no: st.roll_no, code: m.code, reason: req.body.reason || '',
    old_score: m.score, new_score: null, reviewed_by: null, status: 'PENDING', requested_at: new Date() });
  await audit('revaluation_request', req_id, 'REQUESTED', null, 'PENDING', `student#${sid}`);
  res.json({ ok: true });
}));
app.post('/api/reval/:id/review', wrap(async (req, res) => {   // multi-document transaction
  const { decision, new_score: ns, reviewer = 'examiner' } = req.body, approve = decision === 'APPROVE';
  if (approve && !(ns !== null && ns !== '' && +ns >= 0 && +ns <= 100)) throw new Error('Enter a new score between 0 and 100');
  const [R, M] = await Promise.all([col('revals'), col('marks')]);
  const session = (await client()).startSession();
  try {
    await session.withTransaction(async () => {
      const r = await R.findOne({ req_id: +req.params.id }, { session });
      if (!r || r.status !== 'PENDING') throw new Error('Request not found or already closed');
      if (approve) {
        await M.updateOne({ mark_id: r.mark_id }, { $set: { score: +ns } }, { session });
        await audit('marks', r.mark_id, 'SCORE_CHANGED', r.old_score, +ns, reviewer, session);
      }
      const st = approve ? 'COMPLETED' : 'REJECTED';
      await R.updateOne({ req_id: r.req_id }, { $set: { status: st, new_score: approve ? +ns : null, reviewed_by: reviewer, reviewed_at: new Date() } }, { session });
      await audit('revaluation_request', r.req_id, 'STATUS_CHANGED', 'PENDING', st, reviewer, session);
    });
  } finally { await session.endSession(); }
  res.json({ ok: true });
}));

app.get('/api/audit', wrap(async (_, res) => res.json(await (await col('audit')).find().sort({ changed_at: -1 }).limit(100).toArray())));

module.exports = app;
module.exports.alertFor = alertFor;
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('ExamGuard running on port ' + PORT));
}
