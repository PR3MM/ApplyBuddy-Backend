import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String }, // "Intern - ML", "Platform Engineer"
  location: { type: String }, // e.g. "Pune", "Chakan", "Remote"
  mode: { type: String, enum: ['Remote', 'Offline', 'Hybrid'], default: 'Remote' },
  startDate: { type: Date }, // For confirmed offers
  duration: { type: String }, // "6 months", "10 months"
  stipend: { type: String }, // "30,000 per month"
  salaryOnConversion: { type: String }, // e.g. "8.5 LPA"
  ctcRange: { type: String }, // e.g. "21 - 27 LPA"
  eligibility: { type: String }, // "BE/BTech (CS/IT/E&TC) 2026"
  tags: [{ type: String }], // e.g. ["Internship", "Mechanical", "AI", "Female Only"]
  genderRestriction: { type: String, enum: ['Male', 'Female', 'Any','None'], default: 'Any' },
  batch: [{ type: String }], // e.g. ["2026", "2025", "2027"]
  branches: [{ type: String }], // e.g. ["CS", "IT", "E&TC"]
  jobType: { type: String, enum: ['Internship', 'Full-Time', 'Intern + PPO'], default: 'Internship' },
  formLink: { type: String, unique: true }, // Application form or registration link
  sourceEmail: { type: String }, // Original email sender (e.g. s.rawandale@gmail.com)
  sourceName: { type: String }, // Name of source (e.g. Prof. Shitalkumar)
  contactInfo: { type: String }, // Phone or LinkedIn
  selectionProcess: [{ type: String }], // ["Online Test", "Technical Interview", "HR"]
  notes: { type: String },
  isShortlisted: { type: Boolean, default: false }, // If the student is selected
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  //imp
  deadline: { type: Date }, // Application deadline
  status: { type: String, enum: ['active', 'postponed', 'cancelled'], default: 'active' }, // Job status
}, { timestamps: true });

const jobData = mongoose.model('Job', jobSchema)

export default jobData;
