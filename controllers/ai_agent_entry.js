import jobData from '../models/job.js';
import client from '../redis.js';


export async function ai_data_entry(req, res) {
    const {
        company,
        role,
        location,
        mode,
        startDate,
        deadline,
        assessment,   
        duration,
        stipend,
        salaryOnConversion,
        ctcRange,
        eligibility,
        tags,
        genderRestriction,
        batch,
        branches,
        jobType,
        formLink,
        sourceEmail,
        sourceName,
        contactInfo,
        selectionProcess,
        jobDes,
        summary,
        notes,
        isShortlisted,
        status,
        createdAt,
        updatedAt
    } = req.body;

    try {

        const data = {
            company,
            role,
            location,
            mode,
            startDate,
            deadline,
            assessment,
            duration,
            stipend,
            salaryOnConversion,
            ctcRange,
            eligibility,
            tags,
            genderRestriction,
            batch,
            branches,
            jobType,
            formLink,
            sourceEmail,
            sourceName,
            contactInfo,
            selectionProcess,
            jobDes,
            summary,
            notes,
            isShortlisted,
            status,
            createdAt,
            updatedAt
        }

        const newdata = new jobData(data);
        await newdata.save();

        // Invalidate related caches after creating new job
        await Promise.all([
            client.del('all_jobs'),
            client.del('dashboard_data')
        ]);

        res.status(201).json({ message: 'Job data saved successfully' });
    } catch (error) {
        console.error('Error saving tracking data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


export default {ai_data_entry};