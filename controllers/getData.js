import jobData from '../models/job.js';
import client from '../redis.js'; 


export async function getData(req, res) {
    try {
        // Check if data is already cached
        const cachedData = await client.get('all_jobs');
        if (cachedData) {
            console.log('Returning cached data');
            return res.status(200).json({
                success: true,
                data: JSON.parse(cachedData)  
            });
        }

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // // Get active jobs with upcoming deadlines
        // const activeJobs = await jobData.find({
        //     status: 'active',
        //     deadline: { $gte: now }  
        // }).sort({ deadline: 1 }).limit(10);

        // Get expired jobs (deadline passed but within last 24 hours)
        const expiredjobs_time_limit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const expiredJobs = await jobData.find({
            deadline: {
                $lt: now,
                $gte: expiredjobs_time_limit
            }
        }).sort({ deadline: -1 });
        console.log("Expired Jobs:", expiredJobs);

        // Get all jobs if you want to show everything
        // const allJobs = await jobData.find({}).sort({ deadline: 1 }).limit(10);
        const allJobs = await jobData.find({}).sort({ deadline: 1 });
         

        const data = {
                jobs: allJobs,   
                expiredJobs,
                activeJobsCount: allJobs.length,
                expiredJobsCount: expiredJobs.length
            }
        await client.set('all_jobs', JSON.stringify(data));


        res.status(200).json({
            success: true,
            data: {
                jobs: allJobs,
                expiredJobs,
                activeJobsCount: allJobs.length,
                expiredJobsCount: expiredJobs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

const getJobById = async (req, res) => {
    try {
        const job_by_id = await client.get(`job_${req.params.id}`);
        if (job_by_id) {
            console.log('Returning cached job data');
            return res.status(200).json({
                success: true,
                job: JSON.parse(job_by_id)
            });
        }


        const jobId = req.params.id;
        const job = await jobData.findById(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
 
        await client.set(`job_${jobId}`, JSON.stringify(job));
        console.log('Job data cached successfully');

        res.json({
            success: true,
            job: job
        });
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export default {
    getData,
    getJobById
};