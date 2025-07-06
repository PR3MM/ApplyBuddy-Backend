import jobData from '../models/job.js';


export async function ai_data_entry(req, res) {
    const {
        company,
        role,
        location,
        mode,
        startDate,
        deadline,
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
        notes,
        isShortlisted,
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
            notes,
            isShortlisted,
            createdAt,
            updatedAt
        }

        const newdata = new jobData(data);
        await newdata.save();

        res.status(201).json({ message: 'Tracking data saved successfully' });
    } catch (error) {
        console.error('Error saving tracking data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


export default {ai_data_entry};