import jobData from '../models/job.js';
import client from '../redis.js';

export async function job_update(req, res) {
    try {
        const newJobData = req.body;

        if (!newJobData.company) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }
 
        if (newJobData.status && !['active', 'postponed', 'cancelled'].includes(newJobData.status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: active, postponed, or cancelled'
            });
        }

        const searchCriteria = {
            company: newJobData.company
        };
 
        if (newJobData.role) {
            searchCriteria.role = newJobData.role;
        }

        if (newJobData.jobType) {
            searchCriteria.jobType = newJobData.jobType;
        }
 
        if (!newJobData.role && !newJobData.jobType) {
            console.log('Warning: Only company provided for search. This might match multiple records.');
        }

        // Simple field filtering  
        const updateData = {};
        Object.keys(newJobData).forEach(key => {
            const value = newJobData[key];
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        updateData[key] = value;
                    }
                } else {
                    updateData[key] = value;
                }
            }
        });

        updateData.updatedAt = new Date();

        console.log('Search criteria:', searchCriteria);
        console.log('Update data:', Object.keys(updateData));

        if (newJobData.status) {
            updateData.status = newJobData.status;
        }

        // Find existing job and update, or create new one if not found
        const updatedJob = await jobData.findOneAndUpdate(
            searchCriteria,
            { $set: updateData },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        const wasUpdate = !updatedJob.isNew;  


        const jobId = updatedJob._id;
        
        // Invalidate multiple related caches
        await Promise.all([
            client.del(`job_${jobId}`),
            client.del('all_jobs'),         
            client.del('dashboard_data')    
        ]);

        res.status(200).json({
            success: true,
            message: wasUpdate ? 'Job updated successfully' : 'New job created successfully',
            isUpdate: wasUpdate,
            job: updatedJob,
            updatedFields: Object.keys(updateData),
            statusChanged: newJobData.status ? true : false,
            newStatus: newJobData.status || updatedJob.status
        });

    } catch (error) {
        console.error('Job update error:', error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate entry found',
                error: 'A job with this information already exists (possibly duplicate formLink)'
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to process job data',
            error: error.message
        });
    }
}

export default { job_update };