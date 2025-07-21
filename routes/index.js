import { Router } from "express";
const router = Router();
import ai_data_entry from '../controllers/ai_agent_entry.js'
import getData from "../controllers/getData.js";
import manual_data_entry from "../controllers/manual_entry.js";
import { dashboard } from "../controllers/dashboard.js";
import job_update from "../controllers/job_update.js";
import { extension } from "../controllers/extension.js";

router.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to ApplyBuddy API',
        status: 'success'
    }); 
});
router.post('/', (req, res) => { 
    const requestData = req.body;
    console.log('Received POST data:', requestData);
    res.status(200).json({ message: 'Data received successfully', data: requestData });
});
router.get('/dashboard', (req, res) => {
    dashboard(req, res);
});
router.get('/get-data', (req, res) => {
    getData.getData(req, res);
});
router.get('/job/:id', (req, res) => {
    getData.getJobById(req, res);
})
router.post('/manual-entry', (req, res) => {
    manual_data_entry.manual_data_entry(req, res);
})
router.post('/ai-entry', (req, res) => {
    ai_data_entry.ai_data_entry(req, res);
})
// router to update existing job data
router.post('/update-job', (req, res) => {
    job_update.job_update(req, res);
})

router.post('/extension', (req, res) => {

    extension(req, res);
 
});

export default router;

// // Complete example with React
// import React, { useState, useEffect } from 'react';

// const JobDashboard = () => {
//     const [jobs, setJobs] = useState([]);
//     const [selectedJob, setSelectedJob] = useState(null);

//     useEffect(() => {
//         fetchJobs();
//     }, []);

//     const fetchJobs = async () => {
//         try {
//             const response = await fetch('/api/get-data');
//             const data = await response.json();
//             setJobs(data.jobs);
//         } catch (error) {
//             console.error('Error fetching jobs:', error);
//         }
//     };

//     const handleViewMore = async (jobId) => {
//         try {
//             const response = await fetch(`/api/job/${jobId}`);
//             const jobDetails = await response.json();
//             setSelectedJob(jobDetails);
//         } catch (error) {
//             console.error('Error fetching job details:', error);
//         }
//     };

//     return (
//         <div>
//             <div className="jobs-grid">
//                 {jobs.map(job => (
//                     <div key={job._id} className="job-card">
//                         <h3>{job.title}</h3>
//                         <p>{job.company}</p>
//                         <p>{job.location}</p>
//                         <div className="card-buttons">
//                             <button onClick={() => window.open(job.formLink, '_blank')}>
//                                 Form Link
//                             </button>
//                             <button onClick={() => handleViewMore(job._id)}>
//                                 View More
//                             </button>
//                         </div>
//                     </div>
//                 ))}
//             </div>
            
//             {selectedJob && (
//                 <div className="job-details-modal">
//                     <h2>{selectedJob.title}</h2>
//                     <p>Company: {selectedJob.company}</p>
//                     <p>Location: {selectedJob.location}</p>
//                     <p>Deadline: {selectedJob.deadline}</p>
//                     <p>Description: {selectedJob.description}</p>
//                     {/* Add more fields as needed */}
//                     <button onClick={() => setSelectedJob(null)}>Close</button>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default JobDashboard;