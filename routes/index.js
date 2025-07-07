import { Router } from "express";
const router = Router();
import ai_data_entry from '../controllers/ai_agent_entry.js'
import getData from "../controllers/getData.js";
import manual_data_entry from "../controllers/manual_entry.js";

router.get('/',(req,res)=>{
 
})
router.get('/get-data',(req,res)=>{
    getData.getData(req,res);
})
router.post('/manual-entry',(req,res)=>{
manual_data_entry.manual_data_entry(req,res);
})
router.post('/ai-entry',(req,res)=>{
    ai_data_entry.ai_data_entry(req,res);
})

export default router;