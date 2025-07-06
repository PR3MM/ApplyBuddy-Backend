import jobData from '../models/job.js';


export async function getData(req,res){

    try{
        
        // const data = await jobData.fetch(query);
        const data = await jobData.find({});
        res.status(200).json({
            data
        })
    }
    catch{

        res.status(500).json({ message: 'Internal server error' });
    }

}
export default {getData};