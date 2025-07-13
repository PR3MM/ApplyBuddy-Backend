import jobData from '../models/job.js';
import client from '../redis.js'; 

export async function dashboard(req, res) {
    try {
        // Check if dashboard data is already cached 
        const cachedData = await client.get('dashboard_data');
        if (cachedData) {
            console.log('Returning cached dashboard data');
            return res.status(200).json({
                success: true,
                result: JSON.parse(cachedData)
            });
        } 

        // 1. stats
        const stats = {
            jobs: 0,
            internships: 0,
            hackathons: 0,
            importantUpdates: 0,
            deadlineToday: 0,
            assessmentsThisWeek: 0
        };

        const today = new Date();
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
 
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
 
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
 
        const jobs = await jobData.find({
            jobType: 'Job',
            createdAt: { $gte: lastWeek }
        });
        const internships = await jobData.find({
            jobType: 'Internship',
            createdAt: { $gte: lastWeek }
        });
        const hackathons = await jobData.find({
            jobType: 'Hackathon',
            createdAt: { $gte: lastWeek }
        });
         
        const importantUpdates = await jobData.find({
            status: { $in: ['cancelled', 'postponed'] },
            updatedAt: { $gte: lastWeek }
        });
        console.log("Important Updates:", importantUpdates);
         
        const deadlineToday = await jobData.find({
            deadline: { $gte: startOfToday, $lte: endOfToday },
            status: { $ne: 'cancelled' }
        });
         
        const assessmentsThisWeek = await jobData.find({
            assessment: { $gte: startOfWeek, $lte: endOfWeek },
            status: { $ne: 'cancelled' }
        });

        stats.jobs = jobs.length;
        stats.internships = internships.length;
        stats.hackathons = hackathons.length;
        stats.importantUpdates = importantUpdates.length;
        stats.deadlineToday = deadlineToday.length;
        stats.assessmentsThisWeek = assessmentsThisWeek.length;

        // 2. Get job cards in ascending order  
        const jobCards = await jobData.find({
            deadline: { $gte: startOfToday },
            status: { $ne: 'cancelled' }
        }).sort({ createdAt: 1 });

        // res.status(200).json({
        //     success: true,
        //     stats,
        //     jobCards
        // }); 
        
        // Cache the dashboard data  
        const dashboardData = {
            stats,
            jobCards
        };
        await client.set('dashboard_data', JSON.stringify(dashboardData));
        console.log('Dashboard data cached successfully');
        
        
        res.status(200).json({
            success: true,
            result: dashboardData
        }); 

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
}
export default { dashboard };