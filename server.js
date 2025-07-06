import express from 'express'; 
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import router from './routes/index.js';
import cors from 'cors';
dotenv.config();
 
const app = express();
const PORT = process.env.PORT ;

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


connectDB();
app.use('/',router);

app.listen(PORT, () => {
  console.log(`Server running on website at http://localhost:${PORT}`);
});